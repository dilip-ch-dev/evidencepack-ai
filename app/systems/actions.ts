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

function ensureString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function createSystemAction(formData: FormData) {
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
    throw new Error("Invalid AI system input.");
  }

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
}

export async function saveAnswerAction(formData: FormData) {
  const parsed = saveAnswerSchema.safeParse({
    systemId: ensureString(formData.get("systemId")),
    questionId: ensureString(formData.get("questionId")),
    response: ensureString(formData.get("response"))
  });

  if (!parsed.success) {
    throw new Error("Invalid questionnaire response.");
  }

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
}

export async function createEvidenceAction(formData: FormData) {
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
    throw new Error("Invalid evidence input.");
  }

  let filePath: string | null = null;
  let sourceUrl: string | null = parsed.data.sourceUrl || null;

  if (parsed.data.type === EvidenceType.FILE) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("File evidence requires an uploaded file.");
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
    throw new Error("URL evidence requires a valid URL.");
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
}
