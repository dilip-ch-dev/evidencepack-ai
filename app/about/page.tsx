import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";

const steps = [
  ["1", "Import", "Start from a public Hugging Face model card, a structured system card, or a blank record."],
  ["2", "Answer", "Describe purpose, data, oversight, monitoring, incidents, vendors, security, and change controls."],
  ["3", "Attach evidence", "Connect each claim to reviewable evidence and track missing or stale support."],
  ["4", "Assess", "Compute a deterministic readiness score, then generate prose only when retrieved rulebook text supports it."],
  ["5", "Export", "Download a reviewable evidence pack once the system has an assessment."]
] as const;

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-700">How TrueCite works</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink-900 sm:text-5xl">Evidence before confidence.</h1>
          <p className="mt-5 text-base leading-relaxed text-slate-600">
            TrueCite is a portfolio demonstration of an evidence-first AI governance workflow. It helps teams organize system facts, surface documentation gaps, and produce citation-backed readiness assessments. It is not legal advice or a certification service.
          </p>
        </header>

        <ol className="grid gap-4 md:grid-cols-5">
          {steps.map(([number, title, description]) => (
            <li key={number} className="panel-surface p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-signal-100 text-sm font-semibold text-signal-800">{number}</span>
              <h2 className="mt-4 font-display text-xl text-ink-900">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
            </li>
          ))}
        </ol>

        <section className="grid gap-5 rounded-3xl bg-ink-950 p-7 text-paper-50 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl">What “fail-closed” means here</h2>
            <p className="mt-3 text-sm leading-relaxed text-paper-100/75">
              Generated summaries and recommendations must cite a retrieved clause and include a supporting quote that exists in that clause. Unsupported prose is rejected instead of silently displayed.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl">Private browser sessions</h2>
            <p className="mt-3 text-sm leading-relaxed text-paper-100/75">
              Workspace records are isolated with an opaque browser-session cookie. The curated demo is shared; records you create are not listed to other sessions.
            </p>
          </div>
        </section>

        <div>
          <Link href="/systems?mode=demo" className="inline-flex rounded-full bg-ink-900 px-5 py-3 text-sm font-medium text-white">Walk through the demo</Link>
        </div>
      </main>
    </>
  );
}
