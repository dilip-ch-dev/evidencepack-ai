import type { RecommendationWithCitation } from "@/lib/citations";
import { normalizeClauseRef } from "@/lib/citations";
import { findRulebook, getActiveRulebook, type Rulebook } from "@/lib/rulebook";
import type { ObligationCoverage, ScoreBreakdown } from "@/lib/scoring";

/**
 * Structural diff between two assessments of the same system.
 *
 * The question this answers is not "what changed" — a text diff shows that — but
 * "what is responsible for the change". An assessment moves for four distinguishable
 * reasons: the scoring version changed, the rulebook corpus changed, the system's own
 * answers and evidence changed, or the model returned something different from the same
 * inputs. Without separating those, every regression investigation starts from scratch.
 */

export type AssessmentSnapshot = {
  id: string;
  createdAt: Date;
  score: number;
  level: string;
  summary: string;
  scoringVersion: string | null;
  corpusVersion: string | null;
  recommendations: RecommendationWithCitation[];
  citations: Array<{ clauseRef: string; title: string; distance: number }>;
  breakdown: ScoreBreakdown | null;
};

export type FieldChange<T> = {
  before: T;
  after: T;
  changed: boolean;
};

export type ObligationDiff = {
  clauseRef: string;
  title: string;
  scoreBefore: number | null;
  scoreAfter: number | null;
  scoreDelta: number | null;
  statusBefore: ObligationCoverage["status"] | null;
  statusAfter: ObligationCoverage["status"] | null;
  /** Present only in one side — the obligation catalog itself changed. */
  presence: "both" | "added" | "removed";
};

export type RetrievalDiff = {
  added: string[];
  removed: string[];
  reordered: Array<{ clauseRef: string; fromRank: number; toRank: number }>;
  stable: string[];
  /** Jaccard similarity of the two retrieved sets; 1 means identical membership. */
  setSimilarity: number;
};

export type RecommendationDiff = {
  addedClauseRefs: string[];
  removedClauseRefs: string[];
  /** Same clause cited in both, but the recommendation text differs. */
  rewritten: Array<{ clauseRef: string; before: string; after: string }>;
  unchanged: string[];
};

export type AttributionCode =
  | "scoring-version-changed"
  | "corpus-version-changed"
  | "obligation-catalog-changed"
  | "system-inputs-changed"
  | "model-nondeterminism"
  | "no-change";

export type Attribution = {
  code: AttributionCode;
  /** How much of the observed change this explanation accounts for. */
  confidence: "high" | "medium" | "low";
  detail: string;
};

export type AssessmentDiff = {
  changed: boolean;
  before: { id: string; createdAt: Date };
  after: { id: string; createdAt: Date };
  scoringVersion: FieldChange<string | null>;
  corpusVersion: FieldChange<string | null>;
  score: { before: number; after: number; delta: number };
  level: FieldChange<string>;
  summaryChanged: boolean;
  obligations: ObligationDiff[];
  retrieval: RetrievalDiff;
  recommendations: RecommendationDiff;
  attributions: Attribution[];
};

function fieldChange<T>(before: T, after: T): FieldChange<T> {
  return { before, after, changed: before !== after };
}

function resolveRulebook(snapshot: AssessmentSnapshot): Rulebook {
  const id = snapshot.breakdown?.rulebookId ?? snapshot.corpusVersion ?? undefined;
  return (id ? findRulebook(id) : undefined) ?? getActiveRulebook();
}

function diffObligations(
  before: ScoreBreakdown | null,
  after: ScoreBreakdown | null
): ObligationDiff[] {
  const beforeByRef = new Map((before?.obligations ?? []).map((o) => [o.clauseRef, o]));
  const afterByRef = new Map((after?.obligations ?? []).map((o) => [o.clauseRef, o]));
  const allRefs = [...new Set([...beforeByRef.keys(), ...afterByRef.keys()])].sort();

  return allRefs
    .map((clauseRef) => {
      const b = beforeByRef.get(clauseRef);
      const a = afterByRef.get(clauseRef);
      const presence: ObligationDiff["presence"] = b && a ? "both" : a ? "added" : "removed";

      return {
        clauseRef,
        title: a?.title ?? b?.title ?? clauseRef,
        scoreBefore: b?.score ?? null,
        scoreAfter: a?.score ?? null,
        scoreDelta: b && a ? a.score - b.score : null,
        statusBefore: b?.status ?? null,
        statusAfter: a?.status ?? null,
        presence
      };
    })
    .filter(
      (row) =>
        row.presence !== "both" ||
        row.scoreDelta !== 0 ||
        row.statusBefore !== row.statusAfter
    );
}

function diffRetrieval(
  before: AssessmentSnapshot,
  after: AssessmentSnapshot,
  rulebook: Rulebook
): RetrievalDiff {
  const rank = (snapshot: AssessmentSnapshot) => {
    const map = new Map<string, number>();
    snapshot.citations.forEach((citation, index) => {
      const ref = normalizeClauseRef(citation.clauseRef, rulebook);
      if (!map.has(ref)) {
        map.set(ref, index + 1);
      }
    });
    return map;
  };

  const beforeRanks = rank(before);
  const afterRanks = rank(after);

  const added = [...afterRanks.keys()].filter((ref) => !beforeRanks.has(ref)).sort();
  const removed = [...beforeRanks.keys()].filter((ref) => !afterRanks.has(ref)).sort();
  const shared = [...afterRanks.keys()].filter((ref) => beforeRanks.has(ref));

  const reordered = shared
    .filter((ref) => beforeRanks.get(ref) !== afterRanks.get(ref))
    .map((ref) => ({
      clauseRef: ref,
      fromRank: beforeRanks.get(ref) as number,
      toRank: afterRanks.get(ref) as number
    }))
    .sort((a, b) => a.toRank - b.toRank);

  const unionSize = new Set([...beforeRanks.keys(), ...afterRanks.keys()]).size;

  return {
    added,
    removed,
    reordered,
    stable: shared.filter((ref) => beforeRanks.get(ref) === afterRanks.get(ref)).sort(),
    setSimilarity: unionSize === 0 ? 1 : shared.length / unionSize
  };
}

function diffRecommendations(
  before: AssessmentSnapshot,
  after: AssessmentSnapshot,
  rulebook: Rulebook
): RecommendationDiff {
  const index = (items: RecommendationWithCitation[]) => {
    const map = new Map<string, string>();
    for (const item of items) {
      const ref = normalizeClauseRef(item.clauseRef, rulebook);
      // Multiple recommendations may cite one clause; keep the first for text comparison.
      if (!map.has(ref)) {
        map.set(ref, item.text);
      }
    }
    return map;
  };

  const beforeByRef = index(before.recommendations);
  const afterByRef = index(after.recommendations);

  const addedClauseRefs = [...afterByRef.keys()].filter((ref) => !beforeByRef.has(ref)).sort();
  const removedClauseRefs = [...beforeByRef.keys()].filter((ref) => !afterByRef.has(ref)).sort();
  const shared = [...afterByRef.keys()].filter((ref) => beforeByRef.has(ref));

  return {
    addedClauseRefs,
    removedClauseRefs,
    rewritten: shared
      .filter((ref) => beforeByRef.get(ref) !== afterByRef.get(ref))
      .map((ref) => ({
        clauseRef: ref,
        before: beforeByRef.get(ref) as string,
        after: afterByRef.get(ref) as string
      }))
      .sort((a, b) => a.clauseRef.localeCompare(b.clauseRef)),
    unchanged: shared.filter((ref) => beforeByRef.get(ref) === afterByRef.get(ref)).sort()
  };
}

/**
 * Assigns responsibility for the observed change.
 *
 * Version changes are stated as fact because they are recorded, not inferred. The
 * remaining two causes are distinguished by whether retrieval moved: retrieval is a
 * deterministic function of the system's answers and gaps, so identical inputs under
 * identical versions must produce an identical retrieved set. If the set moved, the
 * inputs moved; if only the prose moved, the model did.
 */
function attribute(
  diff: Omit<AssessmentDiff, "attributions" | "changed">
): Attribution[] {
  const attributions: Attribution[] = [];

  if (diff.scoringVersion.changed) {
    attributions.push({
      code: "scoring-version-changed",
      confidence: "high",
      detail: `Scoring changed from ${diff.scoringVersion.before ?? "(unset)"} to ${diff.scoringVersion.after ?? "(unset)"}, so the score is not comparable across these runs.`
    });
  }

  if (diff.corpusVersion.changed) {
    attributions.push({
      code: "corpus-version-changed",
      confidence: "high",
      detail: `Rulebook corpus changed from ${diff.corpusVersion.before ?? "(unset)"} to ${diff.corpusVersion.after ?? "(unset)"}; retrieved clauses come from different source text.`
    });
  }

  const catalogChanged = diff.obligations.some((row) => row.presence !== "both");
  if (catalogChanged) {
    const added = diff.obligations.filter((r) => r.presence === "added").map((r) => r.clauseRef);
    const removed = diff.obligations.filter((r) => r.presence === "removed").map((r) => r.clauseRef);
    attributions.push({
      code: "obligation-catalog-changed",
      confidence: "high",
      detail: `Scored obligations differ${added.length ? `; added ${added.join(", ")}` : ""}${removed.length ? `; removed ${removed.join(", ")}` : ""}.`
    });
  }

  const versionsStable = !diff.scoringVersion.changed && !diff.corpusVersion.changed;
  const retrievalMoved =
    diff.retrieval.added.length > 0 ||
    diff.retrieval.removed.length > 0 ||
    diff.retrieval.reordered.length > 0;

  if (versionsStable && retrievalMoved) {
    attributions.push({
      code: "system-inputs-changed",
      confidence: "high",
      detail: `Versions are identical but retrieval moved (${diff.retrieval.added.length} in, ${diff.retrieval.removed.length} out, ${diff.retrieval.reordered.length} reordered), which means the system's answers, evidence, or open gaps changed.`
    });
  }

  const outputMoved =
    diff.summaryChanged ||
    diff.recommendations.addedClauseRefs.length > 0 ||
    diff.recommendations.removedClauseRefs.length > 0 ||
    diff.recommendations.rewritten.length > 0;

  if (versionsStable && !retrievalMoved && outputMoved) {
    attributions.push({
      code: "model-nondeterminism",
      confidence: diff.recommendations.rewritten.length > 0 && diff.recommendations.addedClauseRefs.length === 0 && diff.recommendations.removedClauseRefs.length === 0 ? "high" : "medium",
      detail:
        "Versions and retrieved clauses are identical, so the same prompt produced different output. Expected at temperature > 0; investigate if the cited clause set changed rather than just the wording."
    });
  }

  if (attributions.length === 0) {
    attributions.push({
      code: "no-change",
      confidence: "high",
      detail: "No structural difference between these assessments."
    });
  }

  return attributions;
}

export function diffAssessments(
  before: AssessmentSnapshot,
  after: AssessmentSnapshot
): AssessmentDiff {
  const rulebook = resolveRulebook(after);

  const partial = {
    before: { id: before.id, createdAt: before.createdAt },
    after: { id: after.id, createdAt: after.createdAt },
    scoringVersion: fieldChange(before.scoringVersion, after.scoringVersion),
    corpusVersion: fieldChange(before.corpusVersion, after.corpusVersion),
    score: { before: before.score, after: after.score, delta: after.score - before.score },
    level: fieldChange(before.level, after.level),
    summaryChanged: before.summary.trim() !== after.summary.trim(),
    obligations: diffObligations(before.breakdown, after.breakdown),
    retrieval: diffRetrieval(before, after, rulebook),
    recommendations: diffRecommendations(before, after, rulebook)
  };

  const attributions = attribute(partial);

  return {
    ...partial,
    changed: !attributions.some((a) => a.code === "no-change"),
    attributions
  };
}

/** Compact human-readable rendering, shared by the CLI and the export pack. */
export function formatDiff(diff: AssessmentDiff): string[] {
  const lines: string[] = [];
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

  lines.push(
    `${diff.before.createdAt.toISOString().slice(0, 19)}Z -> ${diff.after.createdAt.toISOString().slice(0, 19)}Z`
  );
  lines.push(
    `Score ${diff.score.before} -> ${diff.score.after} (${sign(diff.score.delta)})` +
      (diff.level.changed ? `, level ${diff.level.before} -> ${diff.level.after}` : "")
  );

  if (diff.scoringVersion.changed) {
    lines.push(`Scoring version ${diff.scoringVersion.before} -> ${diff.scoringVersion.after}`);
  }
  if (diff.corpusVersion.changed) {
    lines.push(`Corpus version ${diff.corpusVersion.before} -> ${diff.corpusVersion.after}`);
  }

  if (diff.obligations.length > 0) {
    lines.push("Obligation coverage:");
    for (const row of diff.obligations) {
      if (row.presence !== "both") {
        lines.push(`  ${row.clauseRef}: ${row.presence}`);
      } else {
        lines.push(
          `  ${row.clauseRef}: ${row.scoreBefore} -> ${row.scoreAfter} (${sign(row.scoreDelta ?? 0)})` +
            (row.statusBefore !== row.statusAfter ? ` · ${row.statusBefore} -> ${row.statusAfter}` : "")
        );
      }
    }
  }

  const r = diff.retrieval;
  lines.push(
    `Retrieval: ${r.added.length} in, ${r.removed.length} out, ${r.reordered.length} reordered ` +
      `(set similarity ${r.setSimilarity.toFixed(2)})`
  );
  if (r.added.length > 0) {
    lines.push(`  entered: ${r.added.join(", ")}`);
  }
  if (r.removed.length > 0) {
    lines.push(`  left:    ${r.removed.join(", ")}`);
  }
  for (const move of r.reordered) {
    lines.push(`  moved:   ${move.clauseRef} rank ${move.fromRank} -> ${move.toRank}`);
  }

  const rec = diff.recommendations;
  lines.push(
    `Recommendations: ${rec.addedClauseRefs.length} new clause(s) cited, ` +
      `${rec.removedClauseRefs.length} dropped, ${rec.rewritten.length} rewritten, ${rec.unchanged.length} unchanged`
  );
  if (rec.addedClauseRefs.length > 0) {
    lines.push(`  now cited:  ${rec.addedClauseRefs.join(", ")}`);
  }
  if (rec.removedClauseRefs.length > 0) {
    lines.push(`  no longer:  ${rec.removedClauseRefs.join(", ")}`);
  }

  lines.push("Attribution:");
  for (const attribution of diff.attributions) {
    lines.push(`  [${attribution.confidence}] ${attribution.code}: ${attribution.detail}`);
  }

  return lines;
}
