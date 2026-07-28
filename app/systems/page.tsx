import { DeploymentStatus, RiskCategory } from "@/lib/db-enums";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getOrCreatePrimaryWorkspace } from "@/lib/workspace";
import { CreateSystemForm } from "./create-system-form";
import { DemoBanner } from "./demo-banner";
import { HuggingFaceImportForm } from "./hf-import-form";
import { ImportSystemCardForm } from "./import-system-card-form";

export const dynamic = "force-dynamic";

const deploymentOptions = Object.values(DeploymentStatus);
const riskOptions = Object.values(RiskCategory);
const SAMPLE_SYSTEM_NAME = "[SAMPLE DATA] EU HR Screening Assistant";

type PageProps = {
  searchParams?: {
    mode?: string;
  };
};

function isDemoSystem(name: string) {
  return name.startsWith("[SAMPLE DATA]");
}

function modeHref(mode: string) {
  return `/systems?mode=${mode}`;
}

export default async function SystemsPage({ searchParams }: PageProps) {
  const workspace = await getOrCreatePrimaryWorkspace();
  const systems = await prisma.aiSystem.findMany({
    where: {
      workspaceId: workspace.id
    },
    orderBy: {
      updatedAt: "desc"
    },
    include: {
      assessments: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      _count: {
        select: {
          gaps: true,
          evidenceItems: true,
          answers: true
        }
      }
    }
  });

  const sampleSystem = systems.find((system) => system.systemName === SAMPLE_SYSTEM_NAME) ?? null;
  const mode = searchParams?.mode === "demo" || searchParams?.mode === "all" ? searchParams.mode : "live";
  const filteredSystems =
    mode === "demo"
      ? systems.filter((system) => isDemoSystem(system.systemName))
      : mode === "all"
        ? systems
        : systems.filter((system) => !isDemoSystem(system.systemName));

  const realSystemsCount = systems.filter((system) => !isDemoSystem(system.systemName)).length;
  const openGapCount = systems.reduce((sum, system) => sum + system._count.gaps, 0);

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Governance workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              EvidencePack AI
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Turn real AI artifacts into a governed system record: import a public model,
              attach evidence, surface gaps, generate a grounded EU AI Act assessment, and export
              the pack you would hand to a reviewer.
            </p>
            <p className="mt-3 text-sm text-slate-500">Workspace: {workspace.name}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Real systems</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{realSystemsCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Open gaps</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{openGapCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Demo data</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{sampleSystem ? 1 : 0}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="px-2 text-sm font-medium text-slate-600">Workspace mode</span>
        {[
          { id: "live", label: "Live mode", copy: "Hide sample data and focus on real systems" },
          { id: "demo", label: "Demo mode", copy: "Show only the sample walkthrough system" },
          { id: "all", label: "All systems", copy: "See both sample and imported systems" }
        ].map((item) => {
          const active = mode === item.id;
          return (
            <Link
              key={item.id}
              href={modeHref(item.id)}
              className={[
                "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition",
                active
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
        <span className="ml-auto text-xs text-slate-500">
          {mode === "live"
            ? "Best for actual usage and portfolio proof."
            : mode === "demo"
              ? "Best for recruiter walkthroughs."
              : "Good for comparing demo vs real systems."}
        </span>
      </section>

      {mode === "demo" && <DemoBanner sampleSystemId={sampleSystem?.id ?? null} />}

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Real-world import
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  Start from a public Hugging Face model URL.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  This is the fastest way to test a non-sample system. We pull public model-card
                  metadata, create a governance record, attach evidence links, and let you assess it.
                </p>
              </div>
              <a
                href="https://huggingface.co/models"
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Browse Hugging Face
              </a>
            </div>
            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <HuggingFaceImportForm />
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">1. Paste model URL</div>
              <div className="rounded-2xl bg-slate-50 p-4">2. Review generated system record</div>
              <div className="rounded-2xl bg-slate-50 p-4">3. Run assessment + export pack</div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Other ways to create a system</h2>
            <p className="mt-2 text-sm text-slate-600">
              Use advanced import if you already have a structured card, or create the record
              manually when documenting an internal application.
            </p>
            <div className="mt-4 grid gap-4">
              <ImportSystemCardForm />
              <CreateSystemForm
                deploymentOptions={deploymentOptions}
                defaultDeploymentStatus={DeploymentStatus.PLANNED}
                riskOptions={riskOptions}
                defaultRiskCategory={RiskCategory.LIMITED}
              />
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {mode === "live" ? "Your systems" : mode === "demo" ? "Demo system" : "All systems"}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {mode === "live"
                  ? "Real imports and manually created systems appear here."
                  : mode === "demo"
                    ? "Only the seeded walkthrough system is shown."
                    : "Everything in the workspace, including sample data."}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {filteredSystems.length} shown
            </span>
          </div>

          {filteredSystems.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm font-medium text-slate-900">No systems in this view yet.</p>
              <p className="mt-2 text-sm text-slate-600">
                {mode === "live"
                  ? "Import a Hugging Face model above to create your first real system record."
                  : "Switch modes to see other systems in the workspace."}
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4">
              {filteredSystems.map((system) => {
                const latestAssessment = system.assessments[0] ?? null;
                const isDemo = isDemoSystem(system.systemName);
                return (
                  <li key={system.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-slate-900">
                              {system.systemName}
                            </h3>
                            {isDemo && (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                                Demo
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {system.owner} · {system.riskCategory} · {system.deploymentStatus}
                          </p>
                        </div>
                        <Link
                          href={`/systems/${system.id}`}
                          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                          Open workspace
                        </Link>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Answers</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{system._count.answers}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Evidence</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{system._count.evidenceItems}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Open gaps</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{system._count.gaps}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                          {system.versionReleaseIdentifier}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                          {system.geography}
                        </span>
                        {latestAssessment && (
                          <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                            Latest assessment: {latestAssessment.score}/100 · {latestAssessment.level}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
