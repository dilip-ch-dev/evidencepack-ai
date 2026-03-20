"use client";

import { useFormState } from "react-dom";
import { saveAnswerAction } from "../actions";
import { initialActionState, type ActionState } from "../action-state";

type Props = {
  systemId: string;
  questionId: string;
  prompt: string;
  required: boolean;
  defaultResponse: string;
};

export function QuestionAnswerForm({
  systemId,
  questionId,
  prompt,
  required,
  defaultResponse
}: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    saveAnswerAction,
    initialActionState
  );

  return (
    <form action={formAction} className="question-form">
      <input type="hidden" name="systemId" value={systemId} />
      <input type="hidden" name="questionId" value={questionId} />
      <label>
        {prompt}
        <textarea name="response" defaultValue={defaultResponse} required={required} rows={3} />
      </label>
      {state.status === "error" && <p className="chip incomplete inline-chip">{state.message}</p>}
      {state.status === "success" && <p className="chip complete inline-chip">{state.message}</p>}
      <div className="form-actions">
        <button type="submit" className="button secondary">
          Save response
        </button>
      </div>
    </form>
  );
}
