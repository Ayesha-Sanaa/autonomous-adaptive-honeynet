import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Radar, ShieldCheck, Network } from "lucide-react";
import { getCurrentUser } from "@/lib/api";
import { Brand } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const points = [
  { icon: Network, title: "Four decoy services", text: "Fake SSH, web, login and SMB targets that only attackers ever touch." },
  { icon: Radar, title: "Every attacker, one view", text: "Sessions, credentials and commands grouped by who sent them." },
  { icon: ShieldCheck, title: "Mapped to MITRE ATT&CK", text: "Each action is labelled with the technique it matches, never guessed." },
];

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgb(255 255 255 / 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.035) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 30% 20%, black, transparent 75%)",
          }}
        />
        <div className="pointer-events-none absolute -left-32 -top-32 size-[520px] rounded-full bg-brand/10 blur-[120px]" />

        <div className="relative"><Brand /></div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight">
            Watch attackers work, <span className="text-brand">without giving them anything real.</span>
          </h1>
          <ul className="mt-10 space-y-6">
            {points.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-brand">
                  <Icon className="size-[18px]" />
                </span>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="mt-0.5 text-sm leading-relaxed text-muted">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-faint">Final year project · BS Information Technology</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="fade-up w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm text-muted">Authorised analysts only. Accounts are created by an administrator.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
