"use client";

import { useFormState } from "react-dom";
import { createSystemAction } from "./actions";
import { initialActionState, type ActionState } from "./action-state";
import { SubmitButton } from "@/app/components/submit-button";

type Props = {
  deploymentOptions: string[];
  defaultDeploymentStatus: string;
  riskOptions: string[];
  defaultRiskCategory: string;
};

function inputClassName() {
  return "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400";
}

export function CreateSystemForm({
  deploymentOptions,
  defaultDeploymentStatus,
  riskOptions,
  defaultRiskCategory
}: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    createSystemAction,
    initialActionState
  );

  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-900">
        Manual create
      </summary>
      <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-700">
          System Name
          <input className={inputClassName()} name="systemName" required />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          Owner
          <input className={inputClassName()} name="owner" required />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          Deployment Status
          <select className={inputClassName()} name="deploymentStatus" defaultValue={defaultDeploymentStatus}>
            {deploymentOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          Geography
          <input className={inputClassName()} name="geography" required />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          Risk Category
          <select className={inputClassName()} name="riskCategory" defaultValue={defaultRiskCategory}>
            {riskOptions.map((risk) => (
              <option key={risk} value={risk}>
                {risk}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          Version / Release Identifier
          <input className={inputClassName()} name="versionReleaseIdentifier" required />
        </label>
        <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
          Business Purpose
          <textarea className={inputClassName()} name="businessPurpose" required rows={3} />
        </label>
        <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
          Model / Provider Details
          <textarea className={inputClassName()} name="modelProviderDetails" required rows={3} />
        </label>
        <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
          Human Oversight Description
          <textarea className={inputClassName()} name="humanOversightDescription" required rows={3} />
        </label>
        <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
          Intended Users
          <textarea className={inputClassName()} name="intendedUsers" required rows={2} />
        </label>
        <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
          Affected Stakeholders
          <textarea className={inputClassName()} name="affectedStakeholders" required rows={2} />
        </label>
        {state.status === "error" && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 md:col-span-2">{state.message}</p>
        )}
        <div className="md:col-span-2">
          <SubmitButton pendingLabel="Creating workspace…" className="inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
            Create system manually
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}
