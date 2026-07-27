"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseSystemCard } from "@/lib/system-card";
import { importSystemCard } from "@/lib/services/systems";
import type { ActionState } from "./action-state";

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

    return {
      status: "error",
      message: "Could not import system card. Please check the format and try again."
    };
  }
}
