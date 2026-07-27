import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvidencePack AI",
  description:
    "Governance OS for AI systems — evidence packs, gap tracking, and grounded EU AI Act readiness assessments."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
