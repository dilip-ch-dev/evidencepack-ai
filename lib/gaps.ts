import { GapType } from "@/lib/db-enums";
import { prisma } from "@/lib/prisma";

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

export async function recomputeGaps(systemId: string) {
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

  const gapRows: Array<{
    systemId: string;
    sectionId?: string;
    questionId?: string;
    evidenceItemId?: string;
    type: GapType;
    message: string;
  }> = [];

  for (const section of sections) {
    const requiredQuestions = section.questions;
    let answeredCount = 0;

    for (const question of requiredQuestions) {
      const answer = answersByQuestionId.get(question.id);
      if (isAnswered(answer?.response)) {
        answeredCount += 1;
      } else {
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
      gapRows.push({
        systemId,
        sectionId: section.id,
        type: GapType.MISSING_REQUIRED_SECTION,
        message: `Missing required section responses: ${section.title}`
      });
    }

    const sectionEvidence = evidenceBySectionId.get(section.id) ?? [];
    if (sectionEvidence.length === 0) {
      gapRows.push({
        systemId,
        sectionId: section.id,
        type: GapType.MISSING_EVIDENCE,
        message: `No evidence attached for section: ${section.title}`
      });
    }
  }

  for (const evidenceItem of evidenceItems) {
    if (isEvidenceStale(evidenceItem.lastReviewedAt)) {
      gapRows.push({
        systemId,
        sectionId: evidenceItem.sectionId ?? undefined,
        evidenceItemId: evidenceItem.id,
        type: GapType.STALE_EVIDENCE,
        message: `Stale evidence: ${evidenceItem.title}`
      });
    }
  }

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
