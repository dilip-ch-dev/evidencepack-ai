"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-2xl items-center px-6 py-16">
      <section className="panel-surface w-full p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-700">Temporary interruption</p>
        <h1 className="mt-3 font-display text-3xl text-ink-900">TrueCite could not load this view</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Your request was not discarded. Retry now, or return to the workspace if the service is still reconnecting.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white">Try again</button>
          <a href="/systems" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-ink-900">Return to workspace</a>
        </div>
      </section>
    </main>
  );
}
