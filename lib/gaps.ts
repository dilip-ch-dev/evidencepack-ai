import { GapType } from "@/lib/db-enums";
import { prisma } from "@/lib/prisma";
import type { SectionCoverage } from "@/lib/scoring";

const STALE_DAYS = 90;

function isAnswered(response: string | null | undefined) {
  return Boolean(response && response.trim().length > 0);
}

function isEvidenceStale(lastReviewedAt: Date | null) {
  if (!lastReviewedAt) {
    return false;
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  return lastReviewedAt < cutoff;
}

export type GapRow = {
  systemId: string;
  sectionId?: string;
  questionId?: string;
  evidenceItemId?: string;
  type: GapType;
  message: string;
};

export type GapMetrics = {
  totalRequiredQuestions: number;
  answeredRequiredQuestions: number;
  totalSections: number;
  sectionsWithEvidence: number;
  missingEvidenceSections: number;
  missingRequiredSections: number;
  unansweredQuestions: number;
  totalEvidence: number;
  staleEvidenceCount: number;
};

export type GapComputation = {
  gapRows: GapRow[];
  metrics: GapMetrics;
  sections: SectionCoverage[];
};

/**
 * Pure-ish computation of gap rows and quantitative coverage metrics for a system.
 * Reads from the database but does not mutate it, so callers (gap persistence and
 * deterministic scoring) share a single source of truth.
 */
export async function computeGapData(systemId: string): Promise<GapComputation> {
  const [sections, answers, evidenceItems] = await Promise.all([
    prisma.questionnaireSection.findMany({
      include: {
        questions: {
          where: { required: true },
          orderBy: { displayOrder: "asc" }
        }
      },
      orderBy: { displayOrder: "asc" }
    }),
    prisma.answer.findMany({
      where: { systemId }
    }),
    prisma.evidenceItem.findMany({
      where: { systemId }
    })
  ]);

  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const evidenceBySectionId = new Map<string, typeof evidenceItems>();
  for (const evidenceItem of evidenceItems) {
    if (!evidenceItem.sectionId) {
      continue;
    }
    const existing = evidenceBySectionId.get(evidenceItem.sectionId) ?? [];
    evidenceBySectionId.set(evidenceItem.sectionId, [...existing, evidenceItem]);
  }

  const gapRows: GapRow[] = [];
  const sectionCoverage: SectionCoverage[] = [];

  let totalRequiredQuestions = 0;
  let answeredRequiredQuestions = 0;
  let sectionsWithEvidence = 0;
  let missingEvidenceSections = 0;
  let missingRequiredSections = 0;
  let unansweredQuestions = 0;

  for (const section of sections) {
    const requiredQuestions = section.questions;
    let answeredCount = 0;

    for (const question of requiredQuestions) {
      totalRequiredQuestions += 1;
      const answer = answersByQuestionId.get(question.id);
      if (isAnswered(answer?.response)) {
        answeredCount += 1;
        answeredRequiredQuestions += 1;
      } else {
        unansweredQuestions += 1;
        gapRows.push({
          systemId,
          sectionId: section.id,
          questionId: question.id,
          type: GapType.UNANSWERED_QUESTION,
          message: `Unanswered question: ${question.prompt}`
        });
      }
    }

    if (requiredQuestions.length > 0 && answeredCount === 0) {
      missingRequiredSections += 1;
      gapRows.push({
        systemId,
        sectionId: section.id,
        type: GapType.MISSING_REQUIRED_SECTION,
        message: `Missing required section responses: ${section.title}`
      });
    }

    const sectionEvidence = evidenceBySectionId.get(section.id) ?? [];
    const hasEvidence = sectionEvidence.length > 0;
    const staleEvidence = sectionEvidence.some((item) => isEvidenceStale(item.lastReviewedAt));
    if (!hasEvidence) {
      missingEvidenceSections += 1;
      gapRows.push({
        systemId,
        sectionId: section.id,
        type: GapType.MISSING_EVIDENCE,
        message: `No evidence attached for section: ${section.title}`
      });
    } else {
      sectionsWithEvidence += 1;
    }

    sectionCoverage.push({
      sectionKey: section.sectionKey,
      title: section.title,
      requiredQuestions: requiredQuestions.length,
      answeredRequired: answeredCount,
      hasEvidence,
      staleEvidence
    });
  }

  let staleEvidenceCount = 0;
  for (const evidenceItem of evidenceItems) {
    if (isEvidenceStale(evidenceItem.lastReviewedAt)) {
      staleEvidenceCount += 1;
      gapRows.push({
        systemId,
        sectionId: evidenceItem.sectionId ?? undefined,
        evidenceItemId: evidenceItem.id,
        type: GapType.STALE_EVIDENCE,
        message: `Stale evidence: ${evidenceItem.title}`
      });
    }
  }

  return {
    gapRows,
    metrics: {
      totalRequiredQuestions,
      answeredRequiredQuestions,
      totalSections: sections.length,
      sectionsWithEvidence,
      missingEvidenceSections,
      missingRequiredSections,
      unansweredQuestions,
      totalEvidence: evidenceItems.length,
      staleEvidenceCount
    },
    sections: sectionCoverage
  };
}

export async function recomputeGaps(systemId: string) {
  const { gapRows } = await computeGapData(systemId);

  await prisma.$transaction(async (tx) => {
    await tx.gap.deleteMany({
      where: { systemId }
    });

    if (gapRows.length > 0) {
      await tx.gap.createMany({
        data: gapRows
      });
    }
  });
}
