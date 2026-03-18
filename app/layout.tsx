import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvidencePack AI",
  description: "MVP scaffold for audit-ready AI evidence packs"
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
