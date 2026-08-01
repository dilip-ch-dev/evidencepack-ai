import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SAMPLE_SYSTEM_NAME = "[SAMPLE DATA] EU HR Screening Assistant";

export default async function HomePage() {
  const sample = await prisma.aiSystem.findFirst({
    where: { systemName: SAMPLE_SYSTEM_NAME },
    select: { id: true }
  });

  return (
    <div className="landing-shell">
      <SiteHeader variant="dark" />
      <section className="landing-hero">
        <p className="animate-rise text-xs font-semibold uppercase tracking-[0.28em] text-signal-200/90">
          Governance evidence for AI systems
        </p>
        <h1 className="animate-rise-delay font-display text-5xl leading-[1.05] tracking-tight text-paper-50 sm:text-6xl md:text-7xl">
          EvidencePack
          <span className="block text-signal-200">AI</span>
        </h1>
        <p className="animate-rise-delay-2 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Import a model, surface the gaps, and generate a readiness pack grounded in a
          rulebook — with citations that cannot invent clauses the retriever never saw.
        </p>
        <div className="animate-rise-delay-2 flex flex-wrap items-center gap-3 pt-2">
          <Link
            href={sample ? `/systems/${sample.id}` : "/systems?mode=demo"}
            className="inline-flex rounded-full bg-signal-500 px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-signal-200"
          >
            Run the 5-minute demo
          </Link>
          <Link
            href="/systems?mode=live"
            className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-paper-50 transition hover:bg-white/10"
          >
            Import a Hugging Face model
          </Link>
        </div>
        <div className="animate-rise-delay-2 mt-10 grid max-w-3xl gap-4 border-t border-white/10 pt-8 text-sm text-slate-400 sm:grid-cols-3">
          <div>
            <p className="signal-line font-medium text-signal-200">Fail-closed gate</p>
            <p className="mt-1 leading-relaxed">
              Recommendations citing unretrieved clauses are dropped, not repaired.
            </p>
          </div>
          <div>
            <p className="signal-line font-medium text-signal-200">Pluggable rulebooks</p>
            <p className="mt-1 leading-relaxed">
              EU AI Act, OWASP LLM Top 10, and production-readiness checks.
            </p>
          </div>
          <div>
            <p className="signal-line font-medium text-signal-200">Measurable evals</p>
            <p className="mt-1 leading-relaxed">
              Offline gate + retrieval harness with a committed regression snapshot.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
