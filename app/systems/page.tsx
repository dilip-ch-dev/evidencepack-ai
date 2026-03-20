import { DeploymentStatus, RiskCategory } from "@/lib/db-enums";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrCreatePrimaryWorkspace } from "@/lib/workspace";
import { createSystemAction } from "./actions";

export const dynamic = "force-dynamic";

const deploymentOptions = Object.values(DeploymentStatus);
const riskOptions = Object.values(RiskCategory);

export default async function SystemsPage() {
  const workspace = await getOrCreatePrimaryWorkspace();
  const systems = await prisma.aiSystem.findMany({
    where: {
      workspaceId: workspace.id
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return (
    <main className="page-shell">
      <section className="panel">
        <h1>EvidencePack AI</h1>
        <p className="muted">Workspace: {workspace.name}</p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>AI Systems</h2>
        </div>
        {systems.length === 0 ? (
          <p className="muted">No systems yet.</p>
        ) : (
          <ul className="plain-list">
            {systems.map((system) => (
              <li key={system.id} className="list-row">
                <div>
                  <strong>{system.systemName}</strong>
                  <p className="muted small">
                    {system.riskCategory} · {system.deploymentStatus} · {system.versionReleaseIdentifier}
                  </p>
                </div>
                <Link href={`/systems/${system.id}`} className="button secondary">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Create AI System</h2>
        <form action={createSystemAction} className="form-grid">
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
            <select name="deploymentStatus" defaultValue={DeploymentStatus.PLANNED}>
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
            <select name="riskCategory" defaultValue={RiskCategory.LIMITED}>
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

          <div className="span-2 form-actions">
            <button type="submit" className="button">
              Create System
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
