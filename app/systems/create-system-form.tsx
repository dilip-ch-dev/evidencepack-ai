"use client";

import { useFormState } from "react-dom";
import { createSystemAction } from "./actions";
import { initialActionState, type ActionState } from "./action-state";

type Props = {
  deploymentOptions: string[];
  defaultDeploymentStatus: string;
  riskOptions: string[];
  defaultRiskCategory: string;
};

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
    <form action={formAction} className="form-grid">
      <label>
        System Name
        <input name="systemName" required />
      </label>
      <label>
        Owner
        <input name="owner" required />
      </label>
      <label>
        Deployment Status
        <select name="deploymentStatus" defaultValue={defaultDeploymentStatus}>
          {deploymentOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Geography
        <input name="geography" required />
      </label>
      <label>
        Risk Category
        <select name="riskCategory" defaultValue={defaultRiskCategory}>
          {riskOptions.map((risk) => (
            <option key={risk} value={risk}>
              {risk}
            </option>
          ))}
        </select>
      </label>
      <label>
        Version / Release Identifier
        <input name="versionReleaseIdentifier" required />
      </label>
      <label className="span-2">
        Business Purpose
        <textarea name="businessPurpose" required rows={3} />
      </label>
      <label className="span-2">
        Model / Provider Details
        <textarea name="modelProviderDetails" required rows={3} />
      </label>
      <label className="span-2">
        Human Oversight Description
        <textarea name="humanOversightDescription" required rows={3} />
      </label>
      <label className="span-2">
        Intended Users
        <textarea name="intendedUsers" required rows={2} />
      </label>
      <label className="span-2">
        Affected Stakeholders
        <textarea name="affectedStakeholders" required rows={2} />
      </label>
      {state.status === "error" && (
        <p className="span-2 chip incomplete inline-chip">{state.message}</p>
      )}

      <div className="span-2 form-actions">
        <button type="submit" className="button">
          Create System
        </button>
      </div>
    </form>
  );
}
