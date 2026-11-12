import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { LogoMark } from "@/components/logo";
import { LoginForm } from "./login-form";
import { HexField } from "./hex-field";
import { TrapField } from "./trap-field";
import "./login.css";

export const metadata: Metadata = { title: "Sign in" };

const SERVICES = [
  { name: "cowrie", what: "Fake SSH server", color: "#2dd4bf" },
  { name: "web portal", what: "Fake admin login page", color: "#a3e635" },
  { name: "heralding", what: "Fake FTP and Telnet", color: "#38bdf8" },
  { name: "dionaea", what: "Fake Windows file share", color: "#f472b6" },
];

function LoginBrand({ tagline = false }: { tagline?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={32} />
      <span className="text-lg font-semibold">Guardnet</span>
      {tagline && (
        <>
          <span className="h-4 w-px bg-line-strong" />
          <span className="text-sm text-muted">Autonomous Adaptive Honeynet</span>
        </>
      )}
    </div>
  );
}

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="relative grid min-h-screen overflow-hidden lg:grid-cols-2">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <HexField />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(17,21,28,0.35), rgba(17,21,28,0.8))" }}
        />
      </div>

      <section className="relative z-10 hidden flex-col p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0"><TrapField /></div>

        <div className="relative"><LoginBrand tagline /></div>

        <div className="relative mt-16 max-w-xl">
          <h1 className="text-5xl font-semibold leading-tight tracking-tight xl:text-6xl">Let them in. Watch everything.</h1>
          <p className="mt-4 max-w-md text-base text-muted">
            Decoy systems that look real, record every move, and change on their own.
          </p>
        </div>

        <ul className="relative mt-auto grid grid-cols-2 gap-x-8 gap-y-4 xl:grid-cols-4">
          {SERVICES.map((s, i) => (
            <li key={s.name} className="text-xs">
              <p className="flex items-center gap-2 font-mono" style={{ color: s.color }}>
                <span
                  className="dot-pulse size-2 rounded-full"
                  style={{ backgroundColor: s.color, animationDelay: `${i * 400}ms` }}
                />
                {s.name}
              </p>
              <p className="mt-1 text-muted">{s.what}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative z-10 flex items-center justify-center px-6 py-12">
        <div className="card-rise w-full max-w-sm">
          <div className="glow-border rounded-2xl p-px">
          <div className="rounded-2xl bg-surface/95 p-8 backdrop-blur">
            <div className="mb-8 lg:hidden"><LoginBrand /></div>
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="mt-2 text-sm text-muted">Sign in to see what the decoys caught.</p>
            <LoginForm />
            <p className="mt-6 text-center text-sm text-muted">
              Need access?{" "}
              <Link href="/signup" className="smooth font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">Request an account</Link>
            </p>
          </div>
          </div>
        </div>
      </section>
    </main>
  );
}
