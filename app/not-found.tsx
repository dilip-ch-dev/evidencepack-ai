import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-2xl items-center px-6 py-16">
      <section className="panel-surface w-full p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-700">Not found</p>
        <h1 className="mt-3 font-display text-3xl text-ink-900">This workspace item is unavailable</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          It may belong to another private session, or the link may no longer be valid.
        </p>
        <Link href="/systems" className="mt-6 inline-flex rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white">
          Open your workspace
        </Link>
      </section>
    </main>
  );
}
