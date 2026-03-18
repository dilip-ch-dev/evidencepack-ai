import { DeploymentStatus, EvidenceStatus, EvidenceType, RiskCategory } from "@prisma/client";
import { z } from "zod";

const requiredText = z.string().trim().min(1, "Required");

export const createSystemSchema = z.object({
  systemName: requiredText,
  owner: requiredText,
  businessPurpose: requiredText,
  deploymentStatus: z.nativeEnum(DeploymentStatus),
  geography: requiredText,
  modelProviderDetails: requiredText,
  humanOversightDescription: requiredText,
  intendedUsers: requiredText,
  affectedStakeholders: requiredText,
  riskCategory: z.nativeEnum(RiskCategory),
  versionReleaseIdentifier: requiredText
});

export const saveAnswerSchema = z.object({
  systemId: requiredText,
  questionId: requiredText,
  response: requiredText
});

export const createEvidenceSchema = z.object({
  systemId: requiredText,
  sectionId: z.string().trim().optional().default(""),
  title: requiredText,
  description: requiredText,
  type: z.nativeEnum(EvidenceType),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
  owner: requiredText,
  status: z.nativeEnum(EvidenceStatus),
  lastReviewedDate: z.string().trim().optional().default("")
});
