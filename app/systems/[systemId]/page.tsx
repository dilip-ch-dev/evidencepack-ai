import Link from "next/link";
import { notFound } from "next/navigation";
import { recomputeGaps } from "@/lib/gaps";
import { prisma } from "@/lib/prisma";
import { createEvidenceAction, saveAnswerAction } from "../actions";

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
    <main className="system-layout">
      <aside className="panel sticky left-sidebar">
        <Link href="/systems" className="button secondary full-width">
          Back to Systems
        </Link>
        <h2>{system.systemName}</h2>
        <p className="muted small">{system.versionReleaseIdentifier}</p>
        <div className="progress-block">
          <p className="small">Questionnaire Progress</p>
          <strong>{progress}% complete</strong>
          <p className="muted small">
            {answeredRequiredQuestionCount}/{requiredQuestionCount} required questions answered
          </p>
        </div>
        <a href={`/systems/${system.id}/export`} className="button full-width">
          Export Markdown Pack
        </a>
        <hr />
        <nav className="section-nav">
          {sectionSummaries.map((section) => (
            <a key={section.id} href={`#section-${section.id}`} className="nav-item">
              <span>{section.title}</span>
              <span className={`chip ${section.status.toLowerCase()}`}>{section.status}</span>
            </a>
          ))}
        </nav>
      </aside>

      <section className="main-content">
        <article className="panel">
          <h1>System Summary</h1>
          <p className="muted">
            {system.owner} · {system.deploymentStatus} · {system.riskCategory} · {system.geography}
          </p>
          <p>{system.businessPurpose}</p>
          <p className="small muted">Model/provider: {system.modelProviderDetails}</p>
          <p className="small muted">Intended users: {system.intendedUsers}</p>
          <p className="small muted">Affected stakeholders: {system.affectedStakeholders}</p>
          <p className="small muted">Human oversight: {system.humanOversightDescription}</p>
        </article>

        <article className="panel">
          <h2>Open Gaps</h2>
          {system.gaps.length === 0 ? (
            <p className="chip complete inline-chip">No open gaps</p>
          ) : (
            <ul className="plain-list">
              {system.gaps.map((gap) => (
                <li key={gap.id} className="gap-row">
                  <span className="chip incomplete">{gap.type}</span>
                  <span>{gap.message}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        {sectionSummaries.map((section) => (
          <article className="panel" id={`section-${section.id}`} key={section.id}>
            <div className="panel-header">
              <h2>{section.title}</h2>
              <span className={`chip ${section.status.toLowerCase()}`}>{section.status}</span>
            </div>
            <p className="muted small">
              Required answered: {section.answeredRequired}/{section.requiredCount}
            </p>

            {section.questions.map((question) => (
              <form action={saveAnswerAction} className="question-form" key={question.id}>
                <input type="hidden" name="systemId" value={system.id} />
                <input type="hidden" name="questionId" value={question.id} />
                <label>
                  {question.prompt}
                  <textarea
                    name="response"
                    defaultValue={answersByQuestionId.get(question.id) ?? ""}
                    required={question.required}
                    rows={3}
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="button secondary">
                    Save response
                  </button>
                </div>
              </form>
            ))}
          </article>
        ))}
      </section>

      <aside className="panel sticky right-sidebar">
        <h2>Evidence Index</h2>
        {system.evidenceItems.length === 0 ? (
          <p className="muted">No evidence added yet.</p>
        ) : (
          <ul className="plain-list">
            {system.evidenceItems.map((evidenceItem) => {
              const stale = isStale(evidenceItem.lastReviewedAt);
              const status = stale
                ? "STALE"
                : evidenceItem.status === "COMPLETE"
                  ? "COMPLETE"
                  : "INCOMPLETE";
              return (
                <li key={evidenceItem.id} className="evidence-row">
                  <strong>{evidenceItem.title}</strong>
                  <p className="muted small">{evidenceItem.section?.title ?? "Unassigned Section"}</p>
                  <div className="chip-row">
                    <span className={`chip ${status.toLowerCase()}`}>{status}</span>
                    <span className="chip secondary">{evidenceItem.type}</span>
                  </div>
                  {evidenceItem.sourceUrl && (
                    <a href={evidenceItem.sourceUrl} target="_blank" rel="noreferrer" className="small">
                      URL
                    </a>
                  )}
                  {evidenceItem.filePath && (
                    <a href={evidenceItem.filePath} target="_blank" rel="noreferrer" className="small">
                      File
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <hr />

        <h3>Add Evidence</h3>
        <form action={createEvidenceAction} className="stack-form">
          <input type="hidden" name="systemId" value={system.id} />
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Description
            <textarea name="description" rows={2} required />
          </label>
          <label>
            Section
            <select name="sectionId" defaultValue="">
              <option value="">Unassigned</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidence Type
            <select name="type" defaultValue="URL">
              <option value="URL">URL</option>
              <option value="FILE">File</option>
            </select>
          </label>
          <label>
            URL (if type is URL)
            <input name="sourceUrl" type="url" placeholder="https://..." />
          </label>
          <label>
            File (if type is FILE)
            <input name="file" type="file" />
          </label>
          <label>
            Owner
            <input name="owner" defaultValue={system.owner} required />
          </label>
          <label>
            Status
            <select name="status" defaultValue="COMPLETE">
              <option value="COMPLETE">COMPLETE</option>
              <option value="INCOMPLETE">INCOMPLETE</option>
            </select>
          </label>
          <label>
            Last Reviewed Date
            <input name="lastReviewedDate" type="date" />
          </label>
          <button type="submit" className="button">
            Attach Evidence
          </button>
        </form>
      </aside>
    </main>
  );
}
