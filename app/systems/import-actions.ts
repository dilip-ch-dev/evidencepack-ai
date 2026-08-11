"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildSystemCardFromHuggingFace } from "@/lib/huggingface";
import { importSystemCard } from "@/lib/services/systems";
import { parseSystemCard } from "@/lib/system-card";
import type { ActionState } from "./action-state";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/rate-limit";

function ensureString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function importSystemCardAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const content = ensureString(formData.get("content"));
  const parsed = parseSystemCard(content);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message
    };
  }

  try {
    await enforceRateLimit("system-card-import", 10, 10 * 60 * 1000);
    const result = await importSystemCard(parsed.card);
    revalidatePath("/systems");
    redirect(`/systems/${result.system.id}`);
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

    if (error instanceof RateLimitExceededError) {
      return { status: "error", message: `Too many imports. Try again in ${error.retryAfterSeconds} seconds.` };
    }
    return {
      status: "error",
      message: "Could not import system card. Please check the format and try again."
    };
  }
}

export async function importHuggingFaceModelAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const source = ensureString(formData.get("source"));
  if (!source.trim()) {
    return {
      status: "error",
      message: "Paste a Hugging Face model URL or owner/model slug."
    };
  }

  try {
    await enforceRateLimit("huggingface-import", 10, 10 * 60 * 1000);
    const card = await buildSystemCardFromHuggingFace(source);
    const result = await importSystemCard(card);
    revalidatePath("/systems");
    redirect(`/systems/${result.system.id}`);
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

    if (error instanceof RateLimitExceededError) {
      return { status: "error", message: `Too many imports. Try again in ${error.retryAfterSeconds} seconds.` };
    }
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not import the Hugging Face model."
    };
  }
}
