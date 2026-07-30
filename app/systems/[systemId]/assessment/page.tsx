import Link from "next/link";
import { notFound } from "next/navigation";
import { parseCitations, parseRecommendations } from "@/lib/assessment";
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

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Shareable readiness assessment
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {system.systemName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {system.owner} · {system.riskCategory} · {system.deploymentStatus} ·{" "}
          {system.versionReleaseIdentifier}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">{system.businessPurpose}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-2 py-1">
            {system._count.answers} answers
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1">
            {system._count.evidenceItems} evidence items
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1">
            {system.gaps.length} open gaps
          </span>
        </div>
      </header>

      {!assessment ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No assessment yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Generate an assessment from the system detail page, then share this URL.
          </p>
          <Link
            href={`/systems/${system.id}`}
            className="mt-4 inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Open system
          </Link>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Readiness result</h2>
              <p className="mt-1 text-xs text-slate-500">
                Generated {assessment.createdAt.toISOString()} · score is deterministic;
                narrative is RAG-grounded
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-slate-900">{assessment.score}/100</p>
              <p className="text-sm font-medium text-slate-700">{assessment.level}</p>
            </div>
          </div>

          {assessment.confidence === "low" && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Low retrieval confidence — citations may be weakly matched.
            </p>
          )}

          <p className="mt-4 text-sm leading-relaxed text-slate-800">{assessment.summary}</p>

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Grounded recommendations
          </h3>
          <ul className="mt-3 grid gap-3">
            {recommendations.map((recommendation) => (
              <li
                key={`${recommendation.clauseRef}-${recommendation.text.slice(0, 24)}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"
              >
                <span className="font-medium text-slate-900">[{recommendation.clauseRef}]</span>{" "}
                {recommendation.text}
              </li>
            ))}
          </ul>

          {citations.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Retrieved clauses
              </h3>
              <ul className="mt-3 grid gap-2 text-sm text-slate-700">
                {citations.map((citation) => (
                  <li key={`${citation.clauseRef}-${citation.title}`}>
                    {citation.clauseRef} — {citation.title}{" "}
                    <span className="text-xs text-slate-500">
                      (distance {citation.distance.toFixed(4)})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/systems/${system.id}`}
              className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
            >
              Full system record
            </Link>
            <a
              href={`/systems/${system.id}/export`}
              className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Download evidence pack
            </a>
          </div>
        </section>
      )}
    </main>
  );
}
