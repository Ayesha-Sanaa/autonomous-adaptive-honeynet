import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";

const PARTS = [
  { title: "Decoys", text: "Four decoy services pretend to be real: an SSH server, a web portal, FTP and Telnet, and SMB with MySQL. Nothing real lives behind them." },
  { title: "One entry point", text: "All incoming traffic passes through HAProxy before it reaches a decoy." },
  { title: "ATT&CK mapping", text: "Every captured action is matched to MITRE ATT&CK techniques so an analyst sees what the attacker was trying to do." },
  { title: "Adaptive engine", text: "A small PPO model decides what the honeypot should do when an SSH session ends. Decisions are limited to four safe actions and fall back to doing nothing if the model fails." },
  { title: "Shared attacker state", text: "Each decoy keeps its own copy of what it saw about every attacker address, and the copies merge without a central database (a CRDT)." },
  { title: "Live view", text: "New events and decisions appear on the dashboard as they happen." },
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="font-mono text-sm text-muted">Autonomous Adaptive Honeynet</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">See what attackers do when they think nobody is watching.</h1>
      <p className="mt-5 max-w-2xl text-base text-muted">
        A honeynet is a set of fake servers that invite attacks. This one records every move, maps it to MITRE ATT&amp;CK, and lets a small
        learning model adapt the trap. It is a final-year project, built to be inspected, not to protect a real network.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-bg hover:bg-brand-strong">Sign in</Link>
        <Link href="/signup" className="rounded-md border border-line-strong px-5 py-2.5 text-sm hover:bg-surface-2">Request access</Link>
        <Link href="/about" className="rounded-md px-5 py-2.5 text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg">How it works</Link>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {PARTS.map((p) => (
          <section key={p.title} className="rounded-lg border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">{p.title}</h2>
            <p className="mt-2 text-sm text-muted">{p.text}</p>
          </section>
        ))}
      </div>
    </main>
  );
}