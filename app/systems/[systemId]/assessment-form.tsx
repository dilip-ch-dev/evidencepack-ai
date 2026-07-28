"use client";

import { useFormState } from "react-dom";
import { runAssessmentFormAction } from "./actions";

type AssessmentActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialAssessmentActionState: AssessmentActionState = {
  status: "idle",
  message: ""
};

type Props = {
  systemId: string;
};

export function AssessmentForm({ systemId }: Props) {
  const [state, formAction] = useFormState<AssessmentActionState, FormData>(
    runAssessmentFormAction,
    initialAssessmentActionState
  );

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="systemId" value={systemId} />
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
      >
        Generate assessment
      </button>
      {state.status === "error" && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>
      )}
    </form>
  );
}
