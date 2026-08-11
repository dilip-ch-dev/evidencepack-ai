"use client";

import { useFormState } from "react-dom";
import { initialActionState, type ActionState } from "./action-state";
import { importHuggingFaceModelAction } from "./import-actions";
import { SubmitButton } from "@/app/components/submit-button";

export function HuggingFaceImportForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(
    importHuggingFaceModelAction,
    initialActionState
  );

  return (
    <form action={formAction} className="grid gap-3">
      <label className="grid gap-1 text-sm text-slate-700">
        Hugging Face model URL or slug
        <input
          name="source"
          required
          placeholder="https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </label>
      <p className="text-xs text-slate-500">
        We fetch the public model card/metadata and draft a governance record with evidence links.
      </p>
      {state.status === "error" && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>
      )}
      <SubmitButton pendingLabel="Importing model metadata…" className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-sky-700">
        Import from Hugging Face
      </SubmitButton>
    </form>
  );
}
