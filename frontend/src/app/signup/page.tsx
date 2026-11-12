import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { LogoMark } from "@/components/logo";
import { HexField } from "../login/hex-field";
import { SignupForm } from "./signup-form";
import "../login/login.css";

export const metadata: Metadata = { title: "Request an account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <HexField />
        <div className="absolute inset-0" style={{ background: "rgba(17,21,28,0.7)" }} />
      </div>

      <div className="card-rise relative z-10 w-full max-w-md">
        <div className="glow-border rounded-2xl p-px">
          <div className="rounded-2xl bg-surface/95 p-8 backdrop-blur">
            <div className="flex items-center gap-3">
              <LogoMark size={32} />
              <span className="text-lg font-semibold">Guardnet</span>
            </div>
            <h1 className="mt-8 text-2xl font-semibold">Request an account</h1>
            <p className="mt-2 text-sm text-muted">An admin reviews every request. You can sign in once it is approved.</p>
            <SignupForm />
            <p className="mt-6 text-center text-sm text-muted">
              Already approved?{" "}
              <Link href="/login" className="smooth font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
