import { DeploymentStatus, RiskCategory } from "@/lib/db-enums";
import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";
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
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6">
        <header className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-700">
              Workspace
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-tight text-ink-900">
              Systems under review
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
              Import a public model, close the gaps, run a grounded assessment, export the pack.
              Sample data stays out of Live mode so portfolio demos stay honest.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Real systems", value: realSystemsCount },
              { label: "Open gaps", value: openGapCount },
              { label: "Demo", value: sampleSystem ? 1 : 0 }
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-1 font-display text-2xl text-ink-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="flex flex-wrap items-center gap-2">
          {[
            { id: "live", label: "Live" },
            { id: "demo", label: "Demo" },
            { id: "all", label: "All" }
          ].map((item) => {
            const active = mode === item.id;
            return (
              <Link
                key={item.id}
                href={modeHref(item.id)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  active
                    ? "bg-ink-900 text-white"
                    : "bg-white/80 text-slate-700 ring-1 ring-slate-200 hover:bg-white"
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
          <span className="ml-auto text-xs text-slate-500">
            {mode === "live"
              ? "Real systems only"
              : mode === "demo"
                ? "Seeded walkthrough"
                : "Everything in this workspace"}
          </span>
        </section>

        {mode === "demo" && <DemoBanner sampleSystemId={sampleSystem?.id ?? null} />}

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-6 self-start">
            <section className="panel-surface p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-700">
                Fastest path
              </p>
              <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900">
                Import from Hugging Face
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Paste a public model URL. We draft the system record and evidence links so you can
                assess something real in minutes.
              </p>
              <div className="mt-5 rounded-2xl border border-signal-100 bg-signal-50/70 p-4">
                <HuggingFaceImportForm />
              </div>
            </section>

            <details className="panel-surface p-5">
              <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                Other ways to create a system
              </summary>
              <p className="mt-2 text-sm text-slate-600">
                Advanced system-card import, or a blank record for internal apps.
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
            </details>
          </div>

          <section className="panel-surface p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl tracking-tight text-ink-900">
                  {mode === "live" ? "Your systems" : mode === "demo" ? "Demo system" : "All systems"}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Open a workspace to close gaps, assess, and export.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {filteredSystems.length}
              </span>
            </div>

            {filteredSystems.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-paper-50 p-6 text-center">
                <p className="text-sm font-medium text-ink-900">Nothing in this view yet.</p>
                <p className="mt-2 text-sm text-slate-600">
                  {mode === "live"
                    ? "Import a Hugging Face model to create your first real system."
                    : "Switch modes to see other systems."}
                </p>
              </div>
            ) : (
              <ul className="mt-6 grid gap-3">
                {filteredSystems.map((system) => {
                  const latestAssessment = system.assessments[0] ?? null;
                  const isDemo = isDemoSystem(system.systemName);
                  return (
                    <li
                      key={system.id}
                      className="rounded-2xl border border-slate-200 bg-paper-50/80 p-4 transition hover:border-signal-200 hover:bg-white"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-ink-900">
                              {system.systemName}
                            </h3>
                            {isDemo && (
                              <span className="rounded-full bg-signal-100 px-2 py-0.5 text-xs font-medium text-signal-800">
                                Demo
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {system.owner} · {system.riskCategory} · {system.deploymentStatus}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                            <span>{system._count.answers} answers</span>
                            <span>·</span>
                            <span>{system._count.evidenceItems} evidence</span>
                            <span>·</span>
                            <span>{system._count.gaps} gaps</span>
                            {latestAssessment && (
                              <>
                                <span>·</span>
                                <span>
                                  {latestAssessment.score}/100 · {latestAssessment.level}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/systems/${system.id}`}
                          className="inline-flex rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
                        >
                          Open
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>
      </main>
    </>
  );
}
