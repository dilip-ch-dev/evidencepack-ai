"use server";

import { revalidatePath } from "next/cache";
import { generateAssessment } from "@/lib/assessment";

function ensureString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function runAssessmentAction(systemId: string) {
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
