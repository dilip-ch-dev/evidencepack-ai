"use server";

import { revalidatePath } from "next/cache";
import { generateAssessment } from "@/lib/assessment";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/rate-limit";

function ensureString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function runAssessmentAction(systemId: string) {
  try {
    await enforceRateLimit("assessment", 5, 10 * 60 * 1000);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return {
        status: "error" as const,
        message: `Too many assessments. Try again in ${error.retryAfterSeconds} seconds.`
      };
    }
    return { status: "error" as const, message: "Could not check request limits." };
  }

  const result = await generateAssessment(systemId);

  if (result.status === "rate_limited") {
    revalidatePath(`/systems/${systemId}`);

    return {
      status: "success" as const,
      message: result.message,
      assessment: result.assessment ?? undefined
    };
  }

  if (result.status === "error") {
    return {
      status: "error" as const,
      message: result.message
    };
  }

  revalidatePath(`/systems/${systemId}`);

  return {
    status: "success" as const,
    message: result.message,
    assessment: result.assessment
  };
}

export async function runAssessmentFormAction(
  _prevState: { status: "idle" | "success" | "error"; message: string },
  formData: FormData
) {
  const systemId = ensureString(formData.get("systemId"));
  if (!systemId) {
    return {
      status: "error" as const,
      message: "System id is required."
    };
  }

  return runAssessmentAction(systemId);
}
