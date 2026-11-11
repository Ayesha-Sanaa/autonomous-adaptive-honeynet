import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { Brand } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-line bg-surface p-12 lg:flex">
        <Brand />

        <div className="max-w-lg">
          <h1 className="text-4xl font-semibold">See what attackers try before they reach anything real.</h1>
          <p className="mt-4 text-base text-muted">
            Four decoy services record every login, command and scan. Each action is matched to a MITRE ATT&amp;CK technique.
          </p>

          <div className="mt-10 rounded-lg border border-line bg-bg p-4">
            <p className="text-xs text-faint">Example entry, not real data</p>
            <div className="mt-3 space-y-1 font-mono text-xs leading-5 text-muted">
              <p><span className="text-faint">14:02:11</span> cowrie 203.0.113.24 login root <span className="text-danger">failed</span> <span className="text-fg">T1110.001</span></p>
              <p><span className="text-faint">14:02:14</span> cowrie 203.0.113.24 login admin <span className="text-ok">accepted</span> <span className="text-fg">T1078</span></p>
              <p><span className="text-faint">14:02:19</span> cowrie 203.0.113.24 command whoami <span className="text-fg">T1033</span></p>
            </div>
          </div>
        </div>

        <p className="text-xs text-faint">Final year project, BS Information Technology</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-2 text-sm text-muted">Accounts are created by an administrator. If you cannot sign in, ask them to reset your password.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
