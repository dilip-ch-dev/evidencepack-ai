import {
  EvidenceStatus,
  EvidenceType
} from "@/lib/db-enums";
import { recomputeGaps } from "@/lib/gaps";
import { prisma } from "@/lib/prisma";
import type { SystemCard } from "@/lib/system-card";
import type { createSystemSchema } from "@/lib/validation";
import { getOrCreatePrimaryWorkspace } from "@/lib/workspace";
import type { z } from "zod";

type CreateSystemInput = z.infer<typeof createSystemSchema>;

export async function createAiSystem(input: CreateSystemInput) {
  const workspace = await getOrCreatePrimaryWorkspace();
  const system = await prisma.aiSystem.create({
    data: {
      workspaceId: workspace.id,
      ...input
    }
  });
  await recomputeGaps(system.id);
  return system;
}

export type CreateEvidenceInput = {
  systemId: string;
  title: string;
  description: string;
  type: (typeof EvidenceType)[keyof typeof EvidenceType];
  owner: string;
  status: (typeof EvidenceStatus)[keyof typeof EvidenceStatus];
  sectionId?: string | null;
  sectionKey?: string | null;
  sourceUrl?: string | null;
  filePath?: string | null;
  lastReviewedAt?: Date | null;
};

export async function createEvidenceItem(input: CreateEvidenceInput) {
  let sectionId = input.sectionId ?? null;
  if (!sectionId && input.sectionKey) {
    const section = await prisma.questionnaireSection.findUnique({
      where: { sectionKey: input.sectionKey }
    });
    sectionId = section?.id ?? null;
  }

  const evidence = await prisma.evidenceItem.create({
    data: {
      systemId: input.systemId,
      sectionId,
      title: input.title,
      description: input.description,
      type: input.type,
      sourceUrl: input.sourceUrl ?? null,
      filePath: input.filePath ?? null,
      owner: input.owner,
      status: input.status,
      lastReviewedAt: input.lastReviewedAt ?? null
    }
  });

  await recomputeGaps(input.systemId);
  return evidence;
}

export async function importSystemCard(card: SystemCard) {
  const system = await createAiSystem(card.system);

  const questions = await prisma.question.findMany({
    select: { id: true, questionKey: true }
  });
  const questionIdByKey = new Map(questions.map((q) => [q.questionKey, q.id]));

  let answersCreated = 0;
  for (const [questionKey, response] of Object.entries(card.answers)) {
    const questionId = questionIdByKey.get(questionKey);
    if (!questionId) {
      continue;
    }

    await prisma.answer.upsert({
      where: {
        systemId_questionId: {
          systemId: system.id,
          questionId
        }
      },
      update: { response },
      create: {
        systemId: system.id,
        questionId,
        response
      }
    });
    answersCreated += 1;
  }

  let evidenceCreated = 0;
  for (const item of card.evidence) {
    if (item.type === EvidenceType.URL && !item.sourceUrl) {
      continue;
    }

    await createEvidenceItem({
      systemId: system.id,
      title: item.title,
      description: item.description,
      type: item.type,
      owner: item.owner || card.system.owner,
      status: item.status,
      sectionKey: item.sectionKey,
      sourceUrl: item.sourceUrl ?? null,
      lastReviewedAt: item.lastReviewedDate ? new Date(item.lastReviewedDate) : new Date()
    });
    evidenceCreated += 1;
  }

  await recomputeGaps(system.id);

  return {
    system,
    answersCreated,
    evidenceCreated
  };
}

export async function listSystemsSummary() {
  const workspace = await getOrCreatePrimaryWorkspace();
  const systems = await prisma.aiSystem.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    include: {
      assessments: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      _count: {
        select: {
          gaps: true,
          evidenceItems: true,
          answers: true
        }
      }
    }
  });

  return systems.map((system) => ({
    id: system.id,
    systemName: system.systemName,
    owner: system.owner,
    riskCategory: system.riskCategory,
    deploymentStatus: system.deploymentStatus,
    versionReleaseIdentifier: system.versionReleaseIdentifier,
    geography: system.geography,
    updatedAt: system.updatedAt,
    counts: system._count,
    latestAssessment: system.assessments[0]
      ? {
          id: system.assessments[0].id,
          score: system.assessments[0].score,
          level: system.assessments[0].level,
          confidence: system.assessments[0].confidence,
          createdAt: system.assessments[0].createdAt
        }
      : null
  }));
}

export async function getSystemDetail(systemId: string) {
  return prisma.aiSystem.findUnique({
    where: { id: systemId },
    include: {
      answers: {
        include: {
          question: {
            include: { section: true }
          }
        }
      },
      evidenceItems: {
        include: { section: true },
        orderBy: { createdAt: "desc" }
      },
      gaps: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "asc" }
      },
      assessments: {
        orderBy: { createdAt: "desc" },
        take: 5
      }
    }
  });
}
