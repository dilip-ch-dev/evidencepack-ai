import Link from "next/link";

type DemoBannerProps = {
  sampleSystemId: string | null;
};

export function DemoBanner({ sampleSystemId }: DemoBannerProps) {
  return (
    <section className="rounded-3xl border border-signal-200 bg-gradient-to-br from-signal-50 to-white p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-700">
            Demo mode
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900">
            Seeded walkthrough for a five-minute review
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            A high-risk HR screening system with open gaps, so you can show grounded
            recommendations and an exportable pack without setup. Live mode hides this data.
          </p>
        </div>
        <div className="rounded-2xl border border-signal-100 bg-white p-4 text-sm text-slate-700 lg:w-80">
          <p className="font-medium text-ink-900">Click path</p>
          <ol className="mt-3 list-decimal space-y-2 pl-4">
            <li>Open the sample system</li>
            <li>Scan open gaps</li>
            <li>Review the seeded assessment</li>
            <li>Open the assessment view</li>
          </ol>
          <p className="mt-3 rounded-xl bg-signal-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            Grounding proof: the seeded run records one unsupported claim as dropped; only quote-backed claims reach the saved assessment.
          </p>
          {sampleSystemId && (
            <Link
              href={`/systems/${sampleSystemId}`}
              className="mt-4 inline-flex rounded-full bg-signal-600 px-4 py-2 text-sm font-medium text-white hover:bg-signal-700"
            >
              Open sample demo
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
