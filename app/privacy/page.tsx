import { SiteHeader } from "@/app/components/site-header";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-3xl gap-6 px-5 py-10 text-slate-700">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-700">Privacy</p><h1 className="mt-2 font-display text-4xl text-ink-900">What the demo processes</h1></div>
        <section className="panel-surface grid gap-4 p-7 text-sm leading-relaxed">
          <p>TrueCite stores records you create in a hosted PostgreSQL database. An opaque, HTTP-only browser cookie separates your workspace from other browser sessions; it is not an account and does not identify you by name.</p>
          <p>When you generate an assessment, system fields, questionnaire answers, open gaps, and retrieved rulebook excerpts are sent to Google Gemini to produce grounded narrative text. Do not enter secrets, personal data, confidential employer material, or regulated information.</p>
          <p>Hugging Face import fetches public model metadata from the URL you provide. URL evidence remains an outbound link; TrueCite does not copy the linked document.</p>
          <p>Clearing the browser cookie can make your session workspace inaccessible. This portfolio demo does not currently provide account recovery. For deletion requests, use the repository contact channel before submitting sensitive information—which you should avoid entirely.</p>
        </section>
      </main>
    </>
  );
}
