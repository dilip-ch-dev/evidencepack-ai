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
    <form action={formAction} className="stack-form">
      <input type="hidden" name="systemId" value={systemId} />
      <button type="submit" className="button">
        Generate Assessment
      </button>
      {state.status === "error" && <p className="chip incomplete inline-chip">{state.message}</p>}
      {state.status === "success" && <p className="chip complete inline-chip">{state.message}</p>}
    </form>
  );
}
