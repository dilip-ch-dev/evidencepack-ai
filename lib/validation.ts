import { z } from "zod";
import {
  DeploymentStatus,
  EvidenceStatus,
  EvidenceType,
  RiskCategory
} from "@/lib/db-enums";

const requiredText = z.string().trim().min(1, "Required").max(4000, "Too long");
const shortText = requiredText.max(160, "Must be 160 characters or fewer");

export const httpUrl = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Only http and https URLs are allowed");

export const createSystemSchema = z.object({
  systemName: shortText,
  owner: shortText,
  businessPurpose: requiredText,
  deploymentStatus: z.nativeEnum(DeploymentStatus),
  geography: shortText,
  modelProviderDetails: requiredText,
  humanOversightDescription: requiredText,
  intendedUsers: requiredText,
  affectedStakeholders: requiredText,
  riskCategory: z.nativeEnum(RiskCategory),
  versionReleaseIdentifier: shortText
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
  sourceUrl: httpUrl.optional().or(z.literal("")),
  owner: shortText,
  status: z.nativeEnum(EvidenceStatus),
  lastReviewedDate: z.string().trim().optional().default("")
});
