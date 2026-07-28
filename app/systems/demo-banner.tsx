import Link from "next/link";

type DemoBannerProps = {
  sampleSystemId: string | null;
};

export function DemoBanner({ sampleSystemId }: DemoBannerProps) {
  return (
    <section className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Demo mode
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Use the seeded workflow only when you want a recruiter-friendly walkthrough.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Demo mode is intentionally preloaded with a high-risk HR screening system so you can
            show gaps, grounded recommendations, and exports without setup. Real usage should start
            from a live import or manual system creation in Live mode.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-white p-4 text-sm text-slate-700 shadow-sm lg:w-80">
          <p className="font-medium text-slate-900">Suggested click path</p>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm">
            <li>Open the sample system</li>
            <li>Review gaps and stale evidence</li>
            <li>Generate assessment</li>
            <li>Open the shareable assessment page</li>
          </ol>
          {sampleSystemId && (
            <Link
              href={`/systems/${sampleSystemId}`}
              className="mt-4 inline-flex rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Open sample demo
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
