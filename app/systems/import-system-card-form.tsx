"use client";

import { useFormState } from "react-dom";
import { initialActionState, type ActionState } from "./action-state";
import { importSystemCardAction } from "./import-actions";

const PLACEHOLDER = `{
  "system": {
    "systemName": "EU Invoice Anomaly Detector",
    "owner": "Risk Ops",
    "businessPurpose": "Flag anomalous invoices for finance review.",
    "deploymentStatus": "PILOT",
    "geography": "EU",
    "modelProviderDetails": "Vendor classifier v2.1",
    "humanOversightDescription": "Analysts confirm every high-risk flag.",
    "intendedUsers": "Finance operations",
    "affectedStakeholders": "Vendors, finance controllers",
    "riskCategory": "HIGH",
    "versionReleaseIdentifier": "card-v1"
  },
  "answers": {
    "overview-main-function": "Scores invoices and routes anomalies to analysts.",
    "oversight-escalation": "Analysts can override and freeze the model."
  },
  "evidence": [
    {
      "title": "Bias test summary",
      "description": "Latest fairness report",
      "type": "URL",
      "sourceUrl": "https://example.com/bias-report",
      "sectionKey": "risk-controls",
      "owner": "Risk Ops",
      "status": "COMPLETE"
    }
  ]
}`;

export function ImportSystemCardForm() {
  const [state, formAction] = useFormState<ActionState, FormData>(
    importSystemCardAction,
    initialActionState
  );

  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <label className="grid gap-1 text-sm text-slate-700">
        Paste a JSON system card or Markdown model card with YAML frontmatter
        <textarea
          name="content"
          required
          rows={14}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>
      {state.status === "error" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{state.message}</p>
      )}
      <div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        >
          Import system card
        </button>
      </div>
    </form>
  );
}
