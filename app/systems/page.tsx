import { DeploymentStatus, RiskCategory } from "@/lib/db-enums";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrCreatePrimaryWorkspace } from "@/lib/workspace";
import { CreateSystemForm } from "./create-system-form";
import { DemoBanner } from "./demo-banner";
import { ImportSystemCardForm } from "./import-system-card-form";

export const dynamic = "force-dynamic";

const deploymentOptions = Object.values(DeploymentStatus);
const riskOptions = Object.values(RiskCategory);
const SAMPLE_SYSTEM_NAME = "[SAMPLE DATA] EU HR Screening Assistant";

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
  const sampleSystem = systems.find((system) => system.systemName === SAMPLE_SYSTEM_NAME) ?? null;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-900">
          EvidencePack AI
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Governance OS for AI systems — document, gap-check, and export audit-ready
          evidence packs grounded in the EU AI Act.
        </p>
        <p className="mt-2 text-sm text-slate-600">Workspace: {workspace.name}</p>
      </header>

      <DemoBanner sampleSystemId={sampleSystem?.id ?? null} />

      <section
        aria-labelledby="systems-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="systems-heading" className="text-lg font-semibold text-slate-900">
            AI Systems
          </h2>
        </div>
        {systems.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No systems yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {systems.map((system) => (
              <li
                key={system.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {system.systemName}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {system.riskCategory} · {system.deploymentStatus} · {system.versionReleaseIdentifier}
                  </p>
                </div>
                <Link
                  href={`/systems/${system.id}`}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="import-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id="import-heading" className="text-lg font-semibold text-slate-900">
          Import system card
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Connect an existing AI system by importing a JSON system card or Markdown
          model card. This drafts registry fields, questionnaire answers, and
          evidence links — it does not call your model endpoint.
        </p>
        <ImportSystemCardForm />
      </section>

      <section
        aria-labelledby="create-system-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id="create-system-heading" className="text-lg font-semibold text-slate-900">
          Create AI System
        </h2>
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
