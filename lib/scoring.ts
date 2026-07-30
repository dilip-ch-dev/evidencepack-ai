import type { GapMetrics } from "@/lib/gaps";
import {
  CURRENT_SCORING_VERSION,
  SCORING_VERSION_V1,
  SCORING_VERSION_V2
} from "@/lib/obligations";
import { getActiveRulebook, type ClauseFamily, type ObligationDef, type Rulebook } from "@/lib/rulebook";

const COMPLETION_WEIGHT = 60;
const EVIDENCE_WEIGHT = 40;
const STALE_EVIDENCE_PENALTY = 5;
const MISSING_EVIDENCE_PENALTY = 3;

export type SectionCoverage = {
  sectionKey: string;
  title: string;
  requiredQuestions: number;
  answeredRequired: number;
  hasEvidence: boolean;
  staleEvidence: boolean;
};

export type ObligationCoverage = {
  clauseRef: string;
  title: string;
  weight: number;
  family: ClauseFamily;
  sectionKeys: string[];
  answerCoverage: number;
  evidenceCoverage: number;
  score: number;
  status: "covered" | "partial" | "missing";
};

export type ScoreBreakdown = {
  scoringVersion: string;
  rulebookId: string;
  score: number;
  level: string;
  documentationReadiness: number;
  controlReadiness: number;
  /** Rulebook-supplied names for the two readiness axes, for display. */
  familyLabels: { documentation: string; control: string };
  components: {
    questionnaireCompletion: number;
    evidenceCoverage: number;
    staleEvidencePenalty: number;
    missingEvidencePenalty: number;
  };
  obligations: ObligationCoverage[];
};

export function deriveLevel(score: number): string {
  if (score < 40) {
    return "Not Ready";
  }
  if (score <= 75) {
    return "Partially Ready";
  }
  return "Audit-Ready";
}

/** scoring_v1 — original completion/evidence heuristic. */
export function computeReadinessScoreV1(metrics: GapMetrics): number {
  const completionRatio =
    metrics.totalRequiredQuestions === 0
      ? 1
      : metrics.answeredRequiredQuestions / metrics.totalRequiredQuestions;
  const evidenceCoverage =
    metrics.totalSections === 0 ? 1 : metrics.sectionsWithEvidence / metrics.totalSections;

  const base = completionRatio * COMPLETION_WEIGHT + evidenceCoverage * EVIDENCE_WEIGHT;
  const penalty =
    metrics.staleEvidenceCount * STALE_EVIDENCE_PENALTY +
    metrics.missingEvidenceSections * MISSING_EVIDENCE_PENALTY;

  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

function sectionMaps(sections: SectionCoverage[]) {
  return new Map(sections.map((section) => [section.sectionKey, section]));
}

function obligationScore(
  obligation: ObligationDef,
  byKey: Map<string, SectionCoverage>
): ObligationCoverage {
  const mapped = obligation.sectionKeys
    .map((key) => byKey.get(key))
    .filter((section): section is SectionCoverage => Boolean(section));

  if (mapped.length === 0) {
    return {
      clauseRef: obligation.clauseRef,
      title: obligation.title,
      weight: obligation.weight,
      family: obligation.family,
      sectionKeys: obligation.sectionKeys,
      answerCoverage: 0,
      evidenceCoverage: 0,
      score: 0,
      status: "missing"
    };
  }

  const required = mapped.reduce((sum, section) => sum + section.requiredQuestions, 0);
  const answered = mapped.reduce((sum, section) => sum + section.answeredRequired, 0);
  const answerCoverage = required === 0 ? 1 : answered / required;
  const evidenceCoverage =
    mapped.filter((section) => section.hasEvidence && !section.staleEvidence).length /
    mapped.length;
  const score = Math.round((answerCoverage * 0.65 + evidenceCoverage * 0.35) * 100);
  const status: ObligationCoverage["status"] =
    score >= 80 ? "covered" : score >= 40 ? "partial" : "missing";

  return {
    clauseRef: obligation.clauseRef,
    title: obligation.title,
    weight: obligation.weight,
    family: obligation.family,
    sectionKeys: obligation.sectionKeys,
    answerCoverage,
    evidenceCoverage,
    score,
    status
  };
}

/**
 * scoring_v2 — obligation coverage matrix mapped from questionnaire/evidence,
 * plus documentation vs control readiness split.
 */
export function computeReadinessScoreV2(
  metrics: GapMetrics,
  sections: SectionCoverage[],
  rulebook: Rulebook = getActiveRulebook()
): ScoreBreakdown {
  const byKey = sectionMaps(sections);
  const obligations = rulebook.obligations.map((obligation) =>
    obligationScore(obligation, byKey)
  );

  const weightSum = obligations.reduce((sum, item) => sum + item.weight, 0) || 1;
  const weighted =
    obligations.reduce((sum, item) => sum + item.score * item.weight, 0) / weightSum;

  const docs = obligations.filter((item) => item.family === "documentation");
  const controls = obligations.filter((item) => item.family === "control");
  const avg = (items: ObligationCoverage[]) =>
    items.length === 0
      ? 0
      : Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);

  const documentationReadiness = avg(docs);
  const controlReadiness = avg(controls);

  const completionRatio =
    metrics.totalRequiredQuestions === 0
      ? 1
      : metrics.answeredRequiredQuestions / metrics.totalRequiredQuestions;
  const evidenceCoverage =
    metrics.totalSections === 0 ? 1 : metrics.sectionsWithEvidence / metrics.totalSections;
  const stalePenalty = metrics.staleEvidenceCount * STALE_EVIDENCE_PENALTY;
  const missingPenalty = metrics.missingEvidenceSections * MISSING_EVIDENCE_PENALTY;

  // Blend obligation matrix (70%) with classic coverage signal (30%), then apply penalties.
  const blended = weighted * 0.7 + (completionRatio * 60 + evidenceCoverage * 40) * 0.3;
  const score = Math.max(0, Math.min(100, Math.round(blended - stalePenalty - missingPenalty)));

  return {
    scoringVersion: SCORING_VERSION_V2,
    rulebookId: rulebook.id,
    score,
    level: deriveLevel(score),
    documentationReadiness,
    controlReadiness,
    familyLabels: rulebook.familyLabels,
    components: {
      questionnaireCompletion: Math.round(completionRatio * 100),
      evidenceCoverage: Math.round(evidenceCoverage * 100),
      staleEvidencePenalty: stalePenalty,
      missingEvidencePenalty: missingPenalty
    },
    obligations
  };
}

export function computeScoreBreakdown(
  metrics: GapMetrics,
  sections: SectionCoverage[],
  version: string = CURRENT_SCORING_VERSION,
  rulebook: Rulebook = getActiveRulebook()
): ScoreBreakdown {
  if (version === SCORING_VERSION_V1) {
    const score = computeReadinessScoreV1(metrics);
    const completionRatio =
      metrics.totalRequiredQuestions === 0
        ? 1
        : metrics.answeredRequiredQuestions / metrics.totalRequiredQuestions;
    const evidenceCoverage =
      metrics.totalSections === 0 ? 1 : metrics.sectionsWithEvidence / metrics.totalSections;

    return {
      scoringVersion: SCORING_VERSION_V1,
      rulebookId: rulebook.id,
      score,
      level: deriveLevel(score),
      documentationReadiness: Math.round(completionRatio * 100),
      controlReadiness: Math.round(evidenceCoverage * 100),
      familyLabels: rulebook.familyLabels,
      components: {
        questionnaireCompletion: Math.round(completionRatio * 100),
        evidenceCoverage: Math.round(evidenceCoverage * 100),
        staleEvidencePenalty: metrics.staleEvidenceCount * STALE_EVIDENCE_PENALTY,
        missingEvidencePenalty: metrics.missingEvidenceSections * MISSING_EVIDENCE_PENALTY
      },
      obligations: []
    };
  }

  return computeReadinessScoreV2(metrics, sections, rulebook);
}

/** Back-compat helper used by older call sites/tests. */
export function computeReadinessScore(metrics: GapMetrics): number {
  return computeReadinessScoreV1(metrics);
}
