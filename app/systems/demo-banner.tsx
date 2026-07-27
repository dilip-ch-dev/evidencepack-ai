import Link from "next/link";

type DemoBannerProps = {
  sampleSystemId: string | null;
};

export function DemoBanner({ sampleSystemId }: DemoBannerProps) {
  return (
    <section
      aria-labelledby="demo-heading"
      className="rounded-xl border border-sky-200 bg-sky-50 p-6 shadow-sm"
    >
      <h2 id="demo-heading" className="text-lg font-semibold text-slate-900">
        Recruiter / reviewer demo (≈5 minutes)
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-700">
        EvidencePack does not remote-control your model runtime. It turns system
        metadata, questionnaire answers, and evidence into a grounded EU AI Act
        readiness assessment with deterministic scoring and cited obligations.
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          Open the seeded{" "}
          <strong>[SAMPLE DATA] EU HR Screening Assistant</strong>
          {sampleSystemId ? (
            <>
              {" "}
              (
              <Link
                href={`/systems/${sampleSystemId}`}
                className="font-medium text-sky-800 underline underline-offset-2"
              >
                open demo system
              </Link>
              ).
            </>
          ) : (
            " (run seed if missing)."
          )}
        </li>
        <li>Review open gaps — unanswered oversight + missing section evidence.</li>
        <li>
          Click <strong>Generate assessment</strong> to see score/level plus
          article-cited recommendations.
        </li>
        <li>
          Export the Markdown evidence pack, or import your own system card below /
          via <code className="rounded bg-white px-1 py-0.5 text-xs">POST /api/v1/import</code>.
        </li>
      </ol>
      <p className="mt-3 text-xs text-slate-600">
        Use the seeded sample above for cold demos. Production URL after merge:{" "}
        <a
          href="https://evidencepack-ai.vercel.app"
          className="font-medium text-sky-800 underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          evidencepack-ai.vercel.app
        </a>
        . Health:{" "}
        <a
          href="/api/v1/health"
          className="font-medium text-sky-800 underline underline-offset-2"
        >
          /api/v1/health
        </a>
      </p>
    </section>
  );
}
