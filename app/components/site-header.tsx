import Link from "next/link";

type SiteHeaderProps = {
  variant?: "light" | "dark";
};

export function SiteHeader({ variant = "light" }: SiteHeaderProps) {
  const dark = variant === "dark";

  return (
    <header className={["site-header", dark ? "dark" : ""].join(" ")}>
      <div className="site-header-inner">
        <Link href="/" className="group flex items-baseline gap-2">
          <span
            className={[
              "font-display text-xl tracking-tight",
              dark ? "text-paper-50" : "text-ink-900"
            ].join(" ")}
          >
            EvidencePack
          </span>
          <span
            className={[
              "text-[0.65rem] font-semibold uppercase tracking-[0.22em]",
              dark ? "text-signal-200/80" : "text-signal-700"
            ].join(" ")}
          >
            AI
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/systems?mode=demo"
            className={[
              "rounded-full px-3 py-1.5 transition",
              dark
                ? "text-paper-100/80 hover:bg-white/5 hover:text-paper-50"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            ].join(" ")}
          >
            Demo
          </Link>
          <Link
            href="/systems?mode=live"
            className={[
              "rounded-full px-3 py-1.5 font-medium transition",
              dark
                ? "bg-signal-500 text-ink-950 hover:bg-signal-200"
                : "bg-ink-900 text-white hover:bg-ink-800"
            ].join(" ")}
          >
            Open workspace
          </Link>
        </nav>
      </div>
    </header>
  );
}
