"use client";

import { useFormState } from "react-dom";
import { createEvidenceAction } from "../actions";
import { initialActionState, type ActionState } from "../action-state";
import { SubmitButton } from "@/app/components/submit-button";

type SectionOption = {
  id: string;
  title: string;
};

type Props = {
  systemId: string;
  defaultOwner: string;
  sections: SectionOption[];
};

export function EvidenceForm({ systemId, defaultOwner, sections }: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    createEvidenceAction,
    initialActionState
  );

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="systemId" value={systemId} />
      <label className="grid gap-1 text-sm text-slate-700">
        Title
        <input
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          name="title"
          required
        />
      </label>
      <label className="grid gap-1 text-sm text-slate-700">
        Description
        <textarea
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          name="description"
          rows={2}
          required
        />
      </label>
      <label className="grid gap-1 text-sm text-slate-700">
        Section
        <select
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          name="sectionId"
          defaultValue=""
        >
          <option value="">Unassigned</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.title}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-700">
          Evidence Type
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            name="type"
            defaultValue="URL"
          >
            <option value="URL">URL</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          Status
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            name="status"
            defaultValue="COMPLETE"
          >
            <option value="COMPLETE">COMPLETE</option>
            <option value="INCOMPLETE">INCOMPLETE</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm text-slate-700">
        URL (if type is URL)
        <input
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          name="sourceUrl"
          type="url"
          placeholder="https://..."
        />
      </label>
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
        Hosted file uploads are disabled until private object storage is configured. Use an HTTPS evidence link; do not submit confidential material.
      </p>
      <label className="grid gap-1 text-sm text-slate-700">
        Owner
        <input
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          name="owner"
          defaultValue={defaultOwner}
          required
        />
      </label>
      <label className="grid gap-1 text-sm text-slate-700">
        Last Reviewed Date
        <input
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          name="lastReviewedDate"
          type="date"
        />
      </label>
      {state.status === "error" && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>
      )}
      <SubmitButton pendingLabel="Attaching evidence…" className="inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800">
        Attach evidence
      </SubmitButton>
    </form>
  );
}
