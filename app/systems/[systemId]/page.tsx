import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/app/components/site-header";
import { parseCitations, parseRecommendations, parseScoreBreakdown } from "@/lib/assessment";
import { diffAssessments } from "@/lib/assessment-diff";
import { assessmentToSnapshot } from "@/lib/assessment-history";
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
    return "complete";
  }
  if (status === "STALE") {
    return "stale";
  }
  return "incomplete";
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
  const assessmentDiff =
    latestAssessment && previousAssessment
      ? diffAssessments(
          assessmentToSnapshot(previousAssessment),
          assessmentToSnapshot(latestAssessment)
        )
      : null;

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

  const progress =
    requiredQuestionCount === 0
      ? 0
      : Math.round((answeredRequiredQuestionCount / requiredQuestionCount) * 100);

  const assessmentTone =
    latestAssessment?.level === "Audit-Ready"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : latestAssessment?.level === "Partially Ready"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-50 text-slate-800 ring-slate-200";

  return (
    <>
      <SiteHeader />
      <main className="workspace-shell">
        <aside className="workspace-rail">
          <div className="panel-surface p-4">
            <Link href="/systems" className="text-xs font-medium text-signal-700 hover:underline">
              ← Systems
            </Link>
            <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Progress
            </p>
            <p className="mt-1 font-display text-3xl text-ink-900">{progress}%</p>
            <p className="text-xs text-slate-500">
              {answeredRequiredQuestionCount}/{requiredQuestionCount} required answers
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-signal-600" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <nav className="panel-surface p-3">
            <p className="px-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Jump to
            </p>
            <ul className="mt-2 grid gap-1 text-sm">
              {[
                { href: "#gaps", label: `Gaps (${system.gaps.length})` },
                { href: "#assessment", label: "Assessment" },
                { href: "#questionnaire", label: "Questionnaire" },
                { href: "#evidence", label: `Evidence (${system.evidenceItems.length})` }
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="block rounded-xl px-3 py-2 text-slate-700 hover:bg-paper-50 hover:text-ink-900"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="panel-surface p-3">
            <p className="px-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Sections
            </p>
            <ul className="mt-2 grid gap-1">
              {sectionSummaries.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#section-${section.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-paper-50"
                  >
                    <span className="truncate">{section.title}</span>
                    <span className={["status-chip", statusTone(section.status)].join(" ")}>
                      {section.status === "COMPLETE"
                        ? "ok"
                        : section.status === "STALE"
                          ? "stale"
                          : "gap"}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section className="grid gap-5">
          <header className="panel-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {system.versionReleaseIdentifier}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {system.riskCategory}
                  </span>
                </div>
                <h1 className="mt-3 font-display text-3xl tracking-tight text-ink-900">
                  {system.systemName}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{system.businessPurpose}</p>
                <p className="mt-3 text-xs text-slate-500">
                  {system.owner} · {system.deploymentStatus} · {system.geography}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/systems/${system.id}/export`}
                  className="inline-flex rounded-full bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
                >
                  Export pack
                </a>
                <Link
                  href={`/systems/${system.id}/assessment`}
                  className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 hover:bg-paper-50"
                >
                  Shareable view
                </Link>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-paper-50 px-4 py-3">
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Open gaps</p>
                <p className="mt-1 font-display text-2xl text-ink-900">{system.gaps.length}</p>
              </div>
              <div className="rounded-2xl bg-paper-50 px-4 py-3">
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Evidence</p>
                <p className="mt-1 font-display text-2xl text-ink-900">{system.evidenceItems.length}</p>
              </div>
              <div className="rounded-2xl bg-paper-50 px-4 py-3">
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-500">Latest score</p>
                <p className="mt-1 font-display text-2xl text-ink-900">
                  {latestAssessment ? `${latestAssessment.score}/100` : "—"}
                </p>
              </div>
            </div>
          </header>

          <section id="gaps" className="panel-surface scroll-mt-24 p-6">
            <h2 className="font-display text-2xl tracking-tight text-ink-900">Open gaps</h2>
            <p className="mt-2 text-sm text-slate-600">
              What still needs attention before this system looks review-ready.
            </p>
            {system.gaps.length === 0 ? (
              <p className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
                No open gaps
              </p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {system.gaps.map((gap) => (
                  <li key={gap.id} className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="status-chip stale">Needs attention</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                        {gap.type}
                      </span>
                      {gap.section?.title && (
                        <span className="text-xs text-slate-500">{gap.section.title}</span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-800">{gap.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="assessment" className="panel-surface scroll-mt-24 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl tracking-tight text-ink-900">Assessment</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Deterministic score, RAG narrative, fail-closed citations.
                </p>
              </div>
              {latestAssessment && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ink-900 px-3 py-1 text-sm font-semibold text-white">
                    {latestAssessment.score}/100
                  </span>
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset",
                      assessmentTone
                    ].join(" ")}
                  >
                    {latestAssessment.level}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-paper-50 p-4">
              <AssessmentForm systemId={system.id} />
            </div>

            {latestAssessment ? (
              <div className="mt-5 grid gap-4">
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {latestAssessment.scoringVersion && (
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {latestAssessment.scoringVersion}
                    </span>
                  )}
                  {latestAssessment.corpusVersion && (
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      corpus {latestAssessment.corpusVersion}
                    </span>
                  )}
                  {scoreDelta !== null && (
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      Δ score {scoreDelta >= 0 ? "+" : ""}
                      {scoreDelta}
                    </span>
                  )}
                  {latestAssessment.confidence === "low" && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                      Low retrieval confidence
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-slate-800">{latestAssessment.summary}</p>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Grounded recommendations
                  </h3>
                  <ul className="mt-3 grid gap-3">
                    {assessmentRecommendations.map((recommendation) => (
                      <li
                        key={`${recommendation.clauseRef}-${recommendation.text}`}
                        className="rounded-2xl border border-slate-200 bg-paper-50 p-4"
                      >
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                          {recommendation.clauseRef}
                        </span>
                        <p className="mt-3 text-sm leading-relaxed text-slate-800">
                          {recommendation.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                {scoreBreakdown && (
                  <details className="rounded-2xl border border-slate-200 bg-paper-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                      Why this score
                    </summary>
                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            {scoreBreakdown.familyLabels.documentation}
                          </p>
                          <p className="mt-1 font-display text-2xl text-ink-900">
                            {scoreBreakdown.documentationReadiness}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            {scoreBreakdown.familyLabels.control}
                          </p>
                          <p className="mt-1 font-display text-2xl text-ink-900">
                            {scoreBreakdown.controlReadiness}
                          </p>
                        </div>
                      </div>
                      <ul className="grid gap-2 text-sm text-slate-600">
                        <li>
                          Questionnaire completion: {scoreBreakdown.components.questionnaireCompletion}%
                        </li>
                        <li>Evidence coverage: {scoreBreakdown.components.evidenceCoverage}%</li>
                        <li>
                          Penalties: stale {scoreBreakdown.components.staleEvidencePenalty}, missing
                          evidence {scoreBreakdown.components.missingEvidencePenalty}
                        </li>
                      </ul>
                      {scoreBreakdown.obligations.length > 0 && (
                        <div className="grid gap-2">
                          {scoreBreakdown.obligations.map((obligation) => (
                            <div
                              key={obligation.clauseRef}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-ink-900">
                                  {obligation.clauseRef} — {obligation.title}
                                </p>
                                <p className="text-xs text-slate-500">
                                  answers {Math.round(obligation.answerCoverage * 100)}% · evidence{" "}
                                  {Math.round(obligation.evidenceCoverage * 100)}%
                                </p>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                {obligation.score}/100 · {obligation.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )}

                {assessmentDiff && (
                  <details className="rounded-2xl border border-slate-200 bg-paper-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                      What changed since the previous assessment
                    </summary>
                    <div className="mt-4 grid gap-4">
                      <ul className="grid gap-2">
                        {assessmentDiff.attributions.map((attribution) => (
                          <li key={attribution.code} className="text-sm text-slate-700">
                            <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {attribution.confidence}
                            </span>
                            {attribution.detail}
                          </li>
                        ))}
                      </ul>
                      <div className="grid gap-2 text-sm text-slate-600">
                        <p>
                          Score {assessmentDiff.score.before} → {assessmentDiff.score.after}
                          {assessmentDiff.level.changed
                            ? ` · level ${assessmentDiff.level.before} → ${assessmentDiff.level.after}`
                            : ""}
                        </p>
                        <p>
                          Retrieved clauses: {assessmentDiff.retrieval.added.length} in,{" "}
                          {assessmentDiff.retrieval.removed.length} out,{" "}
                          {assessmentDiff.retrieval.reordered.length} reordered
                        </p>
                      </div>
                    </div>
                  </details>
                )}

                {system.assessments.length > 1 && (
                  <details className="rounded-2xl border border-slate-200 bg-paper-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                      Assessment history
                    </summary>
                    <ul className="mt-4 grid gap-2">
                      {system.assessments.map((assessment, index) => (
                        <li
                          key={assessment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-3 text-sm"
                        >
                          <span>
                            {assessment.score}/100 · {assessment.level}
                            {index === 0 ? " (latest)" : ""}
                          </span>
                          <span className="text-xs text-slate-500">
                            {assessment.createdAt.toISOString().slice(0, 19)}Z
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {assessmentCitations.length > 0 && (
                  <details className="rounded-2xl border border-slate-200 bg-paper-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                      Retrieved clauses
                    </summary>
                    <ul className="mt-4 grid gap-2">
                      {assessmentCitations.map((citation) => (
                        <li
                          key={`${citation.clauseRef}-${citation.title}`}
                          className="rounded-xl bg-white px-3 py-3 text-sm"
                        >
                          <p className="font-medium text-ink-900">
                            {citation.clauseRef} · {citation.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            distance {citation.distance.toFixed(3)}
                          </p>
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

          <section id="questionnaire" className="panel-surface scroll-mt-24 p-6">
            <h2 className="font-display text-2xl tracking-tight text-ink-900">Questionnaire</h2>
            <p className="mt-2 text-sm text-slate-600">
              Incomplete sections stay open. Use the left rail to jump.
            </p>
            <div className="mt-5 grid gap-3">
              {sectionSummaries.map((section) => (
                <details
                  key={section.id}
                  id={`section-${section.id}`}
                  open={section.status !== "COMPLETE"}
                  className="scroll-mt-24 rounded-2xl border border-slate-200 bg-paper-50 p-4"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-ink-900">{section.title}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {section.answeredRequired}/{section.requiredCount} required ·{" "}
                          {section.evidenceCount} evidence
                        </p>
                      </div>
                      <span className={["status-chip", statusTone(section.status)].join(" ")}>
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

        <aside id="evidence" className="workspace-rail scroll-mt-24">
          <div className="panel-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl text-ink-900">Evidence index</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {system.evidenceItems.length}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Always visible — attach URLs or files without leaving the workspace.
            </p>
            <div className="mt-4 grid gap-3">
              {system.evidenceItems.length === 0 ? (
                <p className="text-sm text-slate-600">No evidence yet.</p>
              ) : (
                system.evidenceItems.map((item) => {
                  const status = isStale(item.lastReviewedAt)
                    ? "STALE"
                    : item.status === "COMPLETE"
                      ? "COMPLETE"
                      : "INCOMPLETE";
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-paper-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                        <span className={["status-chip", statusTone(status)].join(" ")}>
                          {status === "COMPLETE" ? "ok" : status === "STALE" ? "stale" : "gap"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.section?.title ?? "Unassigned"} · {item.type}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-signal-700 hover:underline"
                          >
                            URL
                          </a>
                        )}
                        {item.filePath && (
                          <a
                            href={item.filePath}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-signal-700 hover:underline"
                          >
                            File
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink-900">
                Add evidence
              </summary>
              <div className="mt-3">
                <EvidenceForm
                  systemId={system.id}
                  defaultOwner={system.owner}
                  sections={sections.map((section) => ({ id: section.id, title: section.title }))}
                />
              </div>
            </details>
          </div>
        </aside>
      </main>
    </>
  );
}
