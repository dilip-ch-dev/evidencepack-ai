import { SiteHeader } from "@/app/components/site-header";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-3xl gap-6 px-5 py-10 text-slate-700">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-700">Terms</p><h1 className="mt-2 font-display text-4xl text-ink-900">Demonstration, not certification</h1></div>
        <section className="panel-surface grid gap-4 p-7 text-sm leading-relaxed">
          <p>TrueCite is a portfolio and research demonstration. Its scores, gap labels, summaries, and recommendations are informational outputs—not legal advice, regulatory certification, audit assurance, or a substitute for qualified professional review.</p>
          <p>You are responsible for the material you submit and must have permission to use it. Do not upload secrets, personal data, confidential employer information, malicious content, or material that violates another party’s rights.</p>
          <p>The service may be changed, rate-limited, reset, or unavailable without notice. AI-generated prose can be incomplete even when its supporting quote is valid; review every output against the source rulebook and your actual obligations.</p>
        </section>
      </main>
    </>
  );
}
