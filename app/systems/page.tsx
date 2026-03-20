import { DeploymentStatus, RiskCategory } from "@/lib/db-enums";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrCreatePrimaryWorkspace } from "@/lib/workspace";
import { CreateSystemForm } from "./create-system-form";

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
        <CreateSystemForm
          deploymentOptions={deploymentOptions}
          defaultDeploymentStatus={DeploymentStatus.PLANNED}
          riskOptions={riskOptions}
          defaultRiskCategory={RiskCategory.LIMITED}
        />
      </section>
    </main>
  );
}
