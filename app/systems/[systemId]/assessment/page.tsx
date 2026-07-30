import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/app/components/site-header";
import { parseCitations, parseRecommendations, parseScoreBreakdown } from "@/lib/assessment";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { systemId: string };
};

export default async function ShareableAssessmentPage({ params }: PageProps) {
  const system = await prisma.aiSystem.findUnique({
    where: { id: params.systemId },
    include: {
      assessments: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      gaps: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "asc" }
      },
      _count: {
        select: {
          evidenceItems: true,
          answers: true
        }
      }
    }
  });

  if (!system) {
    notFound();
  }

  const assessment = system.assessments[0] ?? null;
  const recommendations = assessment ? parseRecommendations(assessment.recommendations) : [];
  const citations = assessment ? parseCitations(assessment.citations) : [];
  const scoreBreakdown = assessment ? parseScoreBreakdown(assessment.scoreBreakdown) : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
        <header className="panel-surface p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-700">
            Shareable readiness assessment
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink-900">
            {system.systemName}
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            {system.owner} · {system.riskCategory} · {system.deploymentStatus} ·{" "}
            {system.versionReleaseIdentifier}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-slate-700">{system.businessPurpose}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-paper-50 px-3 py-1 ring-1 ring-slate-200">
              {system._count.answers} answers
            </span>
            <span className="rounded-full bg-paper-50 px-3 py-1 ring-1 ring-slate-200">
              {system._count.evidenceItems} evidence
            </span>
            <span className="rounded-full bg-paper-50 px-3 py-1 ring-1 ring-slate-200">
              {system.gaps.length} open gaps
            </span>
          </div>
        </header>

        {!assessment ? (
          <section className="panel-surface p-8">
            <h2 className="font-display text-2xl text-ink-900">No assessment yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Generate an assessment from the system workspace, then share this URL.
            </p>
            <Link
              href={`/systems/${system.id}`}
              className="mt-5 inline-flex rounded-full bg-ink-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Open workspace
            </Link>
          </section>
        ) : (
          <section className="panel-surface p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
              <div>
                <h2 className="font-display text-2xl text-ink-900">Readiness result</h2>
                <p className="mt-2 text-xs text-slate-500">
                  Score is deterministic · narrative is retrieval-grounded · citations are
                  fail-closed
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-5xl tracking-tight text-ink-900">
                  {assessment.score}
                  <span className="text-2xl text-slate-400">/100</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{assessment.level}</p>
              </div>
            </div>

            {assessment.confidence === "low" && (
              <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Low retrieval confidence — citations may be weakly matched.
              </p>
            )}

            {(assessment.scoringVersion || assessment.corpusVersion) && (
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
                {assessment.scoringVersion && (
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    {assessment.scoringVersion}
                  </span>
                )}
                {assessment.corpusVersion && (
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    corpus {assessment.corpusVersion}
                  </span>
                )}
              </div>
            )}

            <p className="mt-5 text-base leading-relaxed text-slate-800">{assessment.summary}</p>

            {scoreBreakdown && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-paper-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {scoreBreakdown.familyLabels.documentation}
                  </p>
                  <p className="mt-1 font-display text-3xl text-ink-900">
                    {scoreBreakdown.documentationReadiness}
                  </p>
                </div>
                <div className="rounded-2xl bg-paper-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {scoreBreakdown.familyLabels.control}
                  </p>
                  <p className="mt-1 font-display text-3xl text-ink-900">
                    {scoreBreakdown.controlReadiness}
                  </p>
                </div>
              </div>
            )}

            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Grounded recommendations
            </h3>
            <ul className="mt-4 grid gap-3">
              {recommendations.map((recommendation) => (
                <li
                  key={`${recommendation.clauseRef}-${recommendation.text.slice(0, 24)}`}
                  className="rounded-2xl border border-slate-200 bg-paper-50 p-4 text-sm text-slate-800"
                >
                  <span className="font-semibold text-signal-800">[{recommendation.clauseRef}]</span>{" "}
                  {recommendation.text}
                </li>
              ))}
            </ul>

            {system.gaps.length > 0 && (
              <>
                <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Still open
                </h3>
                <ul className="mt-4 grid gap-2">
                  {system.gaps.slice(0, 6).map((gap) => (
                    <li
                      key={gap.id}
                      className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm text-slate-800"
                    >
                      {gap.message}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {citations.length > 0 && (
              <details className="mt-8 rounded-2xl border border-slate-200 bg-paper-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                  Retrieved clauses ({citations.length})
                </summary>
                <ul className="mt-3 grid gap-2 text-sm text-slate-700">
                  {citations.map((citation) => (
                    <li key={`${citation.clauseRef}-${citation.title}`}>
                      {citation.clauseRef} — {citation.title}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
              <Link
                href={`/systems/${system.id}`}
                className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-ink-900"
              >
                Full workspace
              </Link>
              <a
                href={`/systems/${system.id}/export`}
                className="inline-flex rounded-full bg-ink-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                Download evidence pack
              </a>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
