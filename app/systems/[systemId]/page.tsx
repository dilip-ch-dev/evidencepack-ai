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
  params: { systemId: string };
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

function statusTone(status: string) {
  if (status === "COMPLETE") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }
  if (status === "STALE") {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }
  return "bg-slate-50 text-slate-800 ring-slate-200";
}

export default async function SystemDetailPage({ params }: PageProps) {
  await recomputeGaps(params.systemId);

  const [system, sections] = await Promise.all([
    prisma.aiSystem.findUnique({
      where: { id: params.systemId },
      include: {
        answers: true,
        evidenceItems: {
          include: { section: true },
          orderBy: { createdAt: "desc" }
        },
        gaps: {
          where: { status: "OPEN" },
          include: { section: true },
          orderBy: { createdAt: "asc" }
        },
        assessments: {
          orderBy: { createdAt: "desc" },
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
      orderBy: { displayOrder: "asc" }
    })
  ]);

  if (!system) {
    notFound();
  }

  const answersByQuestionId = new Map(system.answers.map((answer) => [answer.questionId, answer.response]));
  const latestAssessment = system.assessments[0] ?? null;
  const previousAssessment = system.assessments[1] ?? null;
  const assessmentRecommendations = latestAssessment ? parseRecommendations(latestAssessment.recommendations) : [];
  const assessmentCitations = latestAssessment ? parseCitations(latestAssessment.citations) : [];
  const scoreBreakdown = latestAssessment ? parseScoreBreakdown(latestAssessment.scoreBreakdown) : null;
  const scoreDelta = latestAssessment && previousAssessment ? latestAssessment.score - previousAssessment.score : null;

  const evidenceBySectionId = new Map<string, typeof system.evidenceItems>();
  for (const evidenceItem of system.evidenceItems) {
    if (!evidenceItem.sectionId) continue;
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
    const hasStaleEvidence = sectionEvidence.some((item) => isStale(item.lastReviewedAt));

    requiredQuestionCount += requiredQuestions.length;
    answeredRequiredQuestionCount += answeredInSection.length;

    const status = hasStaleEvidence
      ? "STALE"
      : answeredInSection.length === requiredQuestions.length && sectionEvidence.length > 0
        ? "COMPLETE"
        : "INCOMPLETE";

    return {
      ...section,
      status,
      answeredRequired: answeredInSection.length,
      requiredCount: requiredQuestions.length,
      evidenceCount: sectionEvidence.length
    };
  });

  const progress = requiredQuestionCount === 0 ? 0 : Math.round((answeredRequiredQuestionCount / requiredQuestionCount) * 100);
  const assessmentTone = latestAssessment?.level === "Audit-Ready"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : latestAssessment?.level === "Partially Ready"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : "bg-slate-50 text-slate-800 ring-slate-200";

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="grid gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/systems" className="text-sm font-medium text-sky-700 hover:underline">
                  ← Back to systems
                </Link>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {system.versionReleaseIdentifier}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                {system.systemName}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{system.businessPurpose}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-100 px-2 py-1">{system.owner}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">{system.deploymentStatus}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">{system.riskCategory}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">{system.geography}</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <a href={`/systems/${system.id}/export`} className="inline-flex rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800">
                Export pack
              </a>
              <Link href={`/systems/${system.id}/assessment`} className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
                Shareable assessment
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Questionnaire</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{progress}%</p>
              <p className="text-xs text-slate-500">{answeredRequiredQuestionCount}/{requiredQuestionCount} required</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Open gaps</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{system.gaps.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Evidence</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{system.evidenceItems.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Latest score</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{latestAssessment ? `${latestAssessment.score}/100` : "—"}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Assessment</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Run the grounded evaluation, then inspect score rationale and citations.
                </p>
              </div>
              {latestAssessment && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                    {latestAssessment.score}/100
                  </span>
                  <span className={["rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset", assessmentTone].join(" ")}>
                    {latestAssessment.level}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <AssessmentForm systemId={system.id} />
            </div>

            {latestAssessment ? (
              <div className="mt-5 grid gap-4">
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {latestAssessment.scoringVersion && <span className="rounded-full bg-slate-100 px-2 py-1">{latestAssessment.scoringVersion}</span>}
                  {latestAssessment.corpusVersion && <span className="rounded-full bg-slate-100 px-2 py-1">corpus {latestAssessment.corpusVersion}</span>}
                  {scoreDelta !== null && <span className="rounded-full bg-slate-100 px-2 py-1">Δ score {scoreDelta >= 0 ? "+" : ""}{scoreDelta}</span>}
                  {latestAssessment.confidence === "low" && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Low confidence</span>}
                </div>
                <p className="text-sm leading-relaxed text-slate-800">{latestAssessment.summary}</p>

                {scoreBreakdown && (
                  <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4" open>
                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">Why this score</summary>
                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">{scoreBreakdown.familyLabels.documentation}</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">{scoreBreakdown.documentationReadiness}</p>
                        </div>
                        <div className="rounded-xl bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">{scoreBreakdown.familyLabels.control}</p>
                          <p className="mt-1 text-2xl font-semibold text-slate-900">{scoreBreakdown.controlReadiness}</p>
                        </div>
                      </div>
                      <ul className="grid gap-2 text-sm text-slate-600">
                        <li>Questionnaire completion: {scoreBreakdown.components.questionnaireCompletion}%</li>
                        <li>Evidence coverage: {scoreBreakdown.components.evidenceCoverage}%</li>
                        <li>Penalties: stale {scoreBreakdown.components.staleEvidencePenalty}, missing evidence {scoreBreakdown.components.missingEvidencePenalty}</li>
                      </ul>
                      {scoreBreakdown.obligations.length > 0 && (
                        <div className="grid gap-2">
                          {scoreBreakdown.obligations.map((obligation) => (
                            <div key={obligation.clauseRef} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{obligation.clauseRef} — {obligation.title}</p>
                                <p className="text-xs text-slate-500">answers {Math.round(obligation.answerCoverage * 100)}% · evidence {Math.round(obligation.evidenceCoverage * 100)}%</p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{obligation.score}/100 · {obligation.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )}

                <div>
                  <h3 className="text-base font-semibold text-slate-900">Recommendations</h3>
                  <ul className="mt-3 grid gap-3">
                    {assessmentRecommendations.map((recommendation) => (
                      <li key={`${recommendation.clauseRef}-${recommendation.text}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{recommendation.clauseRef}</span>
                        <p className="mt-3 text-sm leading-relaxed text-slate-800">{recommendation.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {system.assessments.length > 1 && (
                  <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">Assessment history</summary>
                    <ul className="mt-4 grid gap-2">
                      {system.assessments.map((assessment, index) => (
                        <li key={assessment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-3 text-sm">
                          <span>{assessment.score}/100 · {assessment.level}{index === 0 ? " (latest)" : ""}</span>
                          <span className="text-xs text-slate-500">{assessment.createdAt.toISOString().slice(0, 19)}Z</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {assessmentCitations.length > 0 && (
                  <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">Retrieved clauses</summary>
                    <ul className="mt-4 grid gap-2">
                      {assessmentCitations.map((citation) => (
                        <li key={`${citation.clauseRef}-${citation.title}`} className="rounded-xl bg-white px-3 py-3 text-sm">
                          <p className="font-medium text-slate-900">{citation.clauseRef} · {citation.title}</p>
                          <p className="mt-1 text-xs text-slate-500">distance {citation.distance.toFixed(3)}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">No assessment generated yet.</p>
            )}
          </div>

          <div className="grid gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Next actions</h2>
              <p className="mt-2 text-sm text-slate-600">What needs attention before this system looks audit-ready.</p>
              {system.gaps.length === 0 ? (
                <p className="mt-4 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">No open gaps</p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {system.gaps.slice(0, 8).map((gap) => (
                    <li key={gap.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Needs attention</span>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{gap.type}</span>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-slate-800">{gap.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Evidence</h2>
                  <p className="mt-2 text-sm text-slate-600">Review current evidence and attach more without leaving the page.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{system.evidenceItems.length} items</span>
              </div>
              <div className="mt-4 grid gap-3">
                {system.evidenceItems.length === 0 ? (
                  <p className="text-sm text-slate-600">No evidence added yet.</p>
                ) : (
                  system.evidenceItems.map((item) => {
                    const status = isStale(item.lastReviewedAt)
                      ? "STALE"
                      : item.status === "COMPLETE"
                        ? "COMPLETE"
                        : "INCOMPLETE";
                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{item.section?.title ?? "Unassigned section"}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={["rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset", statusTone(status)].join(" ")}>{status}</span>
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">{item.type}</span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-sky-700 hover:underline">Open URL</a>}
                          {item.filePath && <a href={item.filePath} target="_blank" rel="noreferrer" className="font-medium text-sky-700 hover:underline">Open file</a>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Add evidence</h3>
                <div className="mt-3">
                  <EvidenceForm
                    systemId={system.id}
                    defaultOwner={system.owner}
                    sections={sections.map((section) => ({ id: section.id, title: section.title }))}
                  />
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Questionnaire workspace</h2>
              <p className="mt-2 text-sm text-slate-600">Click a section to expand it, update answers, and collapse it again when complete.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{sectionSummaries.length} sections</span>
          </div>

          <div className="mt-5 grid gap-4">
            {sectionSummaries.map((section, index) => (
              <details
                key={section.id}
                id={`section-${section.id}`}
                open={section.status !== "COMPLETE" || index === 0}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{section.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {section.answeredRequired}/{section.requiredCount} required answered · {section.evidenceCount} evidence items
                      </p>
                    </div>
                    <span className={["rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset", statusTone(section.status)].join(" ")}>
                      {section.status}
                    </span>
                  </div>
                </summary>
                <div className="mt-4 grid gap-4">
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
                </div>
              </details>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
