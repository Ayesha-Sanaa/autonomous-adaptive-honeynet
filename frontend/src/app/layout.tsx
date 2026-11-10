import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Honeynet", template: "%s · Honeynet" },
  description: "Autonomous Adaptive Honeynet: live attacker activity mapped to MITRE ATT&CK.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#080c11" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
