import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://truecite.vercel.app"),
  title: {
    default: "TrueCite — Evidence-first AI readiness",
    template: "%s | TrueCite"
  },
  description:
    "Evidence-first readiness assessments for AI systems with deterministic scoring, fail-closed grounded prose, gap tracking, and exportable evidence packs.",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "TrueCite",
    title: "TrueCite — Evidence before confidence",
    description: "Build an AI governance evidence pack, surface gaps, and generate prose only when retrieved rulebook text supports it."
  },
  twitter: {
    card: "summary_large_image",
    title: "TrueCite — Evidence before confidence",
    description: "Evidence-first AI readiness assessments with deterministic scoring and fail-closed grounded prose."
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-slate-500">
          <span>TrueCite · Portfolio demonstration · Not legal advice</span>
          <nav className="flex gap-4">
            <a href="/about" className="hover:text-slate-900">How it works</a>
            <a href="/privacy" className="hover:text-slate-900">Privacy</a>
            <a href="/terms" className="hover:text-slate-900">Terms</a>
          </nav>
        </footer>
      </body>
    </html>
  );
}
