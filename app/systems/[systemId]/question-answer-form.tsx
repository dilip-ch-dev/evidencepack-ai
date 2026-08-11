"use client";

import { useFormState } from "react-dom";
import { saveAnswerAction } from "../actions";
import { initialActionState, type ActionState } from "../action-state";
import { SubmitButton } from "@/app/components/submit-button";

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
    <form action={formAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="systemId" value={systemId} />
      <input type="hidden" name="questionId" value={questionId} />
      <label className="grid gap-2 text-sm text-slate-700">
        <span className="font-medium text-slate-900">{prompt}</span>
        <textarea
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          name="response"
          defaultValue={defaultResponse}
          required={required}
          rows={3}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {required && (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            Required
          </span>
        )}
        {state.status === "error" && (
          <p className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800">
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            {state.message}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…" className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
          Save response
        </SubmitButton>
      </div>
    </form>
  );
}
