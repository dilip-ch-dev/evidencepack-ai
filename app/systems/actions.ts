"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { EvidenceType } from "@/lib/db-enums";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recomputeGaps } from "@/lib/gaps";
import { prisma } from "@/lib/prisma";
import { createEvidenceSchema, createSystemSchema, saveAnswerSchema } from "@/lib/validation";
import { getOrCreatePrimaryWorkspace } from "@/lib/workspace";
import type { ActionState } from "./action-state";

function ensureString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function firstIssueMessage(defaultMessage: string, issues: Array<{ message: string }>) {
  return issues[0]?.message || defaultMessage;
}

export async function createSystemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createSystemSchema.safeParse({
    systemName: ensureString(formData.get("systemName")),
    owner: ensureString(formData.get("owner")),
    businessPurpose: ensureString(formData.get("businessPurpose")),
    deploymentStatus: ensureString(formData.get("deploymentStatus")),
    geography: ensureString(formData.get("geography")),
    modelProviderDetails: ensureString(formData.get("modelProviderDetails")),
    humanOversightDescription: ensureString(formData.get("humanOversightDescription")),
    intendedUsers: ensureString(formData.get("intendedUsers")),
    affectedStakeholders: ensureString(formData.get("affectedStakeholders")),
    riskCategory: ensureString(formData.get("riskCategory")),
    versionReleaseIdentifier: ensureString(formData.get("versionReleaseIdentifier"))
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: firstIssueMessage("Invalid AI system input.", parsed.error.issues)
    };
  }

  try {
    const workspace = await getOrCreatePrimaryWorkspace();

    const system = await prisma.aiSystem.create({
      data: {
        workspaceId: workspace.id,
        ...parsed.data
      }
    });

    await recomputeGaps(system.id);
    revalidatePath("/systems");
    redirect(`/systems/${system.id}`);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    return {
      status: "error",
      message: "Could not create AI system. Please check your input and try again."
    };
  }
}

export async function saveAnswerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = saveAnswerSchema.safeParse({
    systemId: ensureString(formData.get("systemId")),
    questionId: ensureString(formData.get("questionId")),
    response: ensureString(formData.get("response"))
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: firstIssueMessage("Invalid questionnaire response.", parsed.error.issues)
    };
  }

  try {
    await prisma.answer.upsert({
      where: {
        systemId_questionId: {
          systemId: parsed.data.systemId,
          questionId: parsed.data.questionId
        }
      },
      update: {
        response: parsed.data.response
      },
      create: parsed.data
    });

    await recomputeGaps(parsed.data.systemId);
    revalidatePath(`/systems/${parsed.data.systemId}`);

    return {
      status: "success",
      message: "Response saved."
    };
  } catch {
    return {
      status: "error",
      message: "Could not save response. Please try again."
    };
  }
}

export async function createEvidenceAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createEvidenceSchema.safeParse({
    systemId: ensureString(formData.get("systemId")),
    sectionId: ensureString(formData.get("sectionId")),
    title: ensureString(formData.get("title")),
    description: ensureString(formData.get("description")),
    type: ensureString(formData.get("type")),
    sourceUrl: ensureString(formData.get("sourceUrl")),
    owner: ensureString(formData.get("owner")),
    status: ensureString(formData.get("status")),
    lastReviewedDate: ensureString(formData.get("lastReviewedDate"))
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: firstIssueMessage("Invalid evidence input.", parsed.error.issues)
    };
  }

  try {
    let filePath: string | null = null;
    let sourceUrl: string | null = parsed.data.sourceUrl || null;

    if (parsed.data.type === EvidenceType.FILE) {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return {
          status: "error",
          message: "File evidence requires an uploaded file."
        };
      }

      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });

      const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const diskFileName = `${Date.now()}-${safeOriginalName}`;
      const diskPath = path.join(uploadDir, diskFileName);

      const bytes = Buffer.from(await file.arrayBuffer());
      await writeFile(diskPath, bytes);

      filePath = `/uploads/${diskFileName}`;
      sourceUrl = null;
    }

    if (parsed.data.type === EvidenceType.URL && !sourceUrl) {
      return {
        status: "error",
        message: "URL evidence requires a valid URL."
      };
    }

    await prisma.evidenceItem.create({
      data: {
        systemId: parsed.data.systemId,
        sectionId: parsed.data.sectionId || null,
        title: parsed.data.title,
        description: parsed.data.description,
        type: parsed.data.type,
        filePath,
        sourceUrl,
        owner: parsed.data.owner,
        status: parsed.data.status,
        lastReviewedAt: parsed.data.lastReviewedDate ? new Date(parsed.data.lastReviewedDate) : null
      }
    });

    await recomputeGaps(parsed.data.systemId);
    revalidatePath(`/systems/${parsed.data.systemId}`);

    return {
      status: "success",
      message: "Evidence added."
    };
  } catch {
    return {
      status: "error",
      message: "Could not add evidence. Please try again."
    };
  }
}
