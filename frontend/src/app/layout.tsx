import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Honeynet", template: "%s | Honeynet" },
  description: "Autonomous Adaptive Honeynet: attacker activity mapped to MITRE ATT&CK.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#11151c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
