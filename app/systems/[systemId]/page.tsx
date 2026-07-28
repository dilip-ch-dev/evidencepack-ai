import Link from "next/link";
import { notFound } from "next/navigation";
import { parseCitations, parseRecommendations, parseScoreBreakdown } from "@/lib/assessment";
import { recomputeGaps } from "@/lib/gaps";
import { prisma } from "@/lib/prisma";
import { AssessmentForm } from "./assessment-form";
import { EvidenceForm } from "./evidence-form";
import { QuestionAnswerForm } from "./question-answer-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    systemId: string;
  };
};

const STALE_DAYS = 90;

function isStale(date: Date | null) {
  if (!date) {
    return false;
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  return date < cutoff;
}

export default async function SystemDetailPage({ params }: PageProps) {
  await recomputeGaps(params.systemId);

  const [system, sections] = await Promise.all([
    prisma.aiSystem.findUnique({
      where: { id: params.systemId },
      include: {
        answers: true,
        evidenceItems: {
          include: {
            section: true
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        gaps: {
          where: {
            status: "OPEN"
          },
          include: {
            section: true
          },
          orderBy: {
            createdAt: "asc"
          }
        },
        assessments: {
          orderBy: {
            createdAt: "desc"
          },
          take: 5
        }
      }
    }),
    prisma.questionnaireSection.findMany({
      include: {
        questions: {
          orderBy: { displayOrder: "asc" }
        }
      },
      orderBy: {
        displayOrder: "asc"
      }
    })
  ]);

  if (!system) {
    notFound();
  }

  const answersByQuestionId = new Map(
    system.answers.map((answer) => [answer.questionId, answer.response])
  );
  const latestAssessment = system.assessments[0] ?? null;
  const previousAssessment = system.assessments[1] ?? null;
  const assessmentRecommendations = latestAssessment
    ? parseRecommendations(latestAssessment.recommendations)
    : [];
  const assessmentCitations = latestAssessment ? parseCitations(latestAssessment.citations) : [];
  const scoreBreakdown = latestAssessment
    ? parseScoreBreakdown(latestAssessment.scoreBreakdown)
    : null;
  const assessmentLevelTone =
    latestAssessment?.level === "Audit-Ready"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : latestAssessment?.level === "Partially Ready"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-50 text-slate-800 ring-slate-200";
  const assessmentConfidence = latestAssessment?.confidence ?? null;
  const scoreDelta =
    latestAssessment && previousAssessment
      ? latestAssessment.score - previousAssessment.score
      : null;

  const evidenceBySectionId = new Map<string, typeof system.evidenceItems>();
  for (const evidenceItem of system.evidenceItems) {
    if (!evidenceItem.sectionId) {
      continue;
    }
    const current = evidenceBySectionId.get(evidenceItem.sectionId) ?? [];
    evidenceBySectionId.set(evidenceItem.sectionId, [...current, evidenceItem]);
  }

  let requiredQuestionCount = 0;
  let answeredRequiredQuestionCount = 0;

  const sectionSummaries = sections.map((section) => {
    const requiredQuestions = section.questions.filter((question) => question.required);
    const answeredInSection = requiredQuestions.filter((question) =>
      Boolean(answersByQuestionId.get(question.id)?.trim())
    );
    const sectionEvidence = evidenceBySectionId.get(section.id) ?? [];
    const hasStaleEvidence = sectionEvidence.some((evidenceItem) => isStale(evidenceItem.lastReviewedAt));

    requiredQuestionCount += requiredQuestions.length;
    answeredRequiredQuestionCount += answeredInSection.length;

    const status =
      hasStaleEvidence
        ? "STALE"
        : answeredInSection.length === requiredQuestions.length && sectionEvidence.length > 0
          ? "COMPLETE"
          : "INCOMPLETE";

    return {
      ...section,
      status,
      answeredRequired: answeredInSection.length,
      requiredCount: requiredQuestions.length
    };
  });

  const progress =
    requiredQuestionCount === 0
      ? 0
      : Math.round((answeredRequiredQuestionCount / requiredQuestionCount) * 100);

  return (
    <main className="grid gap-6 px-4 py-6 lg:grid-cols-[280px_1fr_320px]">
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] self-start overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
        <Link
          href="/systems"
          className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        >
          Back to Systems
        </Link>

        <div className="mt-4">
          <h2 className="text-base font-semibold text-slate-900">{system.systemName}</h2>
          <p className="mt-1 text-sm text-slate-600">{system.versionReleaseIdentifier}</p>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">Questionnaire Progress</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">{progress}%</p>
            <p className="text-xs text-slate-600">
              {answeredRequiredQuestionCount}/{requiredQuestionCount} required
            </p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-900/80"
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        <a
          href={`/systems/${system.id}/export`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        >
          Export Markdown Pack
        </a>
        <Link
          href={`/systems/${system.id}/assessment`}
          className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        >
          Shareable assessment
        </Link>

        <hr className="my-4 border-slate-200" />

        <nav className="grid gap-2" aria-label="Questionnaire sections">
          {sectionSummaries.map((section) => (
            <a
              key={section.id}
              href={`#section-${section.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              <span className="truncate">{section.title}</span>
              <span
                className={[
                  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                  section.status === "COMPLETE"
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : section.status === "STALE"
                      ? "bg-amber-50 text-amber-800 ring-amber-200"
                      : "bg-slate-50 text-slate-800 ring-slate-200"
                ].join(" ")}
              >
                {section.status}
              </span>
            </a>
          ))}
        </nav>
      </aside>

      <section className="mx-auto grid w-full max-w-3xl gap-6">
        <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-900">
                {system.systemName}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{system.versionReleaseIdentifier}</p>
            </div>
            <Link
              href="/systems"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 lg:hidden"
            >
              Back
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-700">
            {system.owner} · {system.deploymentStatus} · {system.riskCategory} · {system.geography}
          </p>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-slate-900">
            {system.businessPurpose}
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="grid gap-1">
              <dt className="font-medium text-slate-900">Model/provider</dt>
              <dd className="text-slate-700">{system.modelProviderDetails}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-slate-900">Intended users</dt>
              <dd className="text-slate-700">{system.intendedUsers}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-slate-900">Affected stakeholders</dt>
              <dd className="text-slate-700">{system.affectedStakeholders}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-medium text-slate-900">Human oversight</dt>
              <dd className="text-slate-700">{system.humanOversightDescription}</dd>
            </div>
          </dl>
        </header>

        <section
          aria-labelledby="open-gaps-heading"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 id="open-gaps-heading" className="text-lg font-semibold text-slate-900">
            Open Gaps
          </h2>
          {system.gaps.length === 0 ? (
            <p className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
              No open gaps
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {system.gaps.map((gap) => (
                <li key={gap.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                      Needs attention
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                      {gap.type}
                    </span>
                  </div>
                  <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-900">
                    {gap.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="assessment-heading"
          className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="assessment-heading" className="text-xl font-semibold text-slate-900">
                AI Readiness Assessment
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Grounded in retrieved EU AI Act obligations; score/level computed from coverage.
              </p>
            </div>
            {latestAssessment && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                  {latestAssessment.score}/100
                </span>
                <span
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
                    assessmentLevelTone
                  ].join(" ")}
                >
                  {latestAssessment.level}
                </span>
              </div>
            )}
          </div>

          <div className="mt-4">
            <AssessmentForm systemId={system.id} />
          </div>

          {latestAssessment ? (
            <div className="mt-5 grid gap-4">
              {assessmentConfidence === "low" && (
                <p className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Needs attention: low confidence (weak retrieval grounding)
                </p>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {latestAssessment.scoringVersion && (
                  <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                    {latestAssessment.scoringVersion}
                  </span>
                )}
                {latestAssessment.corpusVersion && (
                  <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                    corpus {latestAssessment.corpusVersion}
                  </span>
                )}
                {scoreDelta !== null && (
                  <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                    Δ score {scoreDelta >= 0 ? "+" : ""}
                    {scoreDelta} vs prior run
                  </span>
                )}
                <Link
                  href={`/systems/${system.id}/assessment`}
                  className="rounded-full bg-white px-2 py-1 font-medium text-sky-800 ring-1 ring-slate-200"
                >
                  Shareable page
                </Link>
              </div>

              <p className="max-w-prose text-sm leading-relaxed text-slate-900">
                {latestAssessment.summary}
              </p>

              {scoreBreakdown && (
                <details className="rounded-lg border border-slate-200 bg-white p-4" open>
                  <summary className="cursor-pointer text-sm font-medium text-slate-900">
                    Why this score
                  </summary>
                  <div className="mt-3 grid gap-3 text-sm text-slate-700">
                    <p>
                      Documentation readiness:{" "}
                      <strong>{scoreBreakdown.documentationReadiness}</strong> · Control
                      readiness: <strong>{scoreBreakdown.controlReadiness}</strong>
                    </p>
                    <ul className="grid gap-1 text-xs text-slate-600">
                      <li>
                        Questionnaire completion:{" "}
                        {scoreBreakdown.components.questionnaireCompletion}%
                      </li>
                      <li>
                        Evidence coverage: {scoreBreakdown.components.evidenceCoverage}%
                      </li>
                      <li>
                        Penalties: stale {scoreBreakdown.components.staleEvidencePenalty}, missing
                        evidence {scoreBreakdown.components.missingEvidencePenalty}
                      </li>
                    </ul>
                    {scoreBreakdown.obligations.length > 0 && (
                      <div className="mt-1 grid gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Obligation coverage
                        </p>
                        {scoreBreakdown.obligations.map((obligation) => (
                          <div
                            key={obligation.articleRef}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <span className="text-xs font-medium text-slate-900">
                              {obligation.articleRef} — {obligation.title}
                            </span>
                            <span className="text-xs text-slate-700">
                              {obligation.score}/100 · {obligation.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )}

              <h3 className="text-base font-semibold text-slate-900">Recommendations</h3>
              {assessmentRecommendations.length === 0 ? (
                <p className="text-sm text-slate-600">No recommendations provided.</p>
              ) : (
                <ul className="grid gap-3">
                  {assessmentRecommendations.map((recommendation) => (
                    <li
                      key={`${recommendation.articleRef}-${recommendation.text}`}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                          {recommendation.articleRef}
                        </span>
                        {assessmentConfidence === "low" && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                            Low confidence
                          </span>
                        )}
                      </div>
                      <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-900">
                        {recommendation.text}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {assessmentCitations.length > 0 && (
                <details className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">
                    Retrieved Sources
                  </summary>
                  <ul className="mt-3 grid gap-2">
                    {assessmentCitations.map((citation) => (
                      <li
                        key={`${citation.articleRef}-${citation.title}`}
                        className="rounded-md border border-slate-200 bg-slate-50 p-3"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {citation.articleRef} · {citation.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Distance: {citation.distance.toFixed(3)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {system.assessments.length > 1 && (
                <details className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-900">
                    Assessment history
                  </summary>
                  <ul className="mt-3 grid gap-2 text-sm text-slate-700">
                    {system.assessments.map((item, index) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2"
                      >
                        <span>
                          {item.score}/100 · {item.level}
                          {index === 0 ? " (latest)" : ""}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.createdAt.toISOString().slice(0, 19)}Z
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No assessment generated yet.</p>
          )}
        </section>

        {sectionSummaries.map((section) => (
          <section
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            id={`section-${section.id}`}
            key={section.id}
            aria-labelledby={`section-heading-${section.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2
                id={`section-heading-${section.id}`}
                className="text-lg font-semibold text-slate-900"
              >
                {section.title}
              </h2>
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
                  section.status === "COMPLETE"
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : section.status === "STALE"
                      ? "bg-amber-50 text-amber-800 ring-amber-200"
                      : "bg-slate-50 text-slate-800 ring-slate-200"
                ].join(" ")}
              >
                {section.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Required answered: {section.answeredRequired}/{section.requiredCount}
            </p>

            {section.questions.map((question) => (
              <QuestionAnswerForm
                key={question.id}
                systemId={system.id}
                questionId={question.id}
                prompt={question.prompt}
                required={question.required}
                defaultResponse={answersByQuestionId.get(question.id) ?? ""}
              />
            ))}
          </section>
        ))}
      </section>

      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] self-start overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
        <h2 className="text-base font-semibold text-slate-900">Evidence Index</h2>
        {system.evidenceItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No evidence added yet.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {system.evidenceItems.map((evidenceItem) => {
              const stale = isStale(evidenceItem.lastReviewedAt);
              const status = stale
                ? "STALE"
                : evidenceItem.status === "COMPLETE"
                  ? "COMPLETE"
                  : "INCOMPLETE";
              const statusTone =
                status === "COMPLETE"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : status === "STALE"
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-slate-50 text-slate-800 ring-slate-200";
              return (
                <li key={evidenceItem.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">{evidenceItem.title}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {evidenceItem.section?.title ?? "Unassigned Section"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                        statusTone
                      ].join(" ")}
                    >
                      {status}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                      {evidenceItem.type}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {evidenceItem.sourceUrl && (
                      <a
                        href={evidenceItem.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
                      >
                        URL
                      </a>
                    )}
                    {evidenceItem.filePath && (
                      <a
                        href={evidenceItem.filePath}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
                      >
                        File
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <hr className="my-4 border-slate-200" />

        <h3 className="text-sm font-semibold text-slate-900">Add Evidence</h3>
        <div className="mt-2">
          <EvidenceForm
            systemId={system.id}
            defaultOwner={system.owner}
            sections={sections.map((section) => ({ id: section.id, title: section.title }))}
          />
        </div>
      </aside>
    </main>
  );
}
