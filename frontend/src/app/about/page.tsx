import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

const LIMITS = [
  "The learning model was trained and scored on the author's own simulator. A simple hand-written rule scored about the same, so the benefit of the model is not proven.",
  "A decoy action is recorded, not carried out: the system notes that a fake file should be planted, but only the fake files built into the decoy are really there.",
  "The explanation next to each decision comes from hand-written rules, not from the model.",
  "In this lab setup the decoys see the address of the network gateway instead of the real attacker address.",
  "The shared state only tells the decoys what has been seen. The decoys do not change their behaviour because of it.",
];

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-xs text-muted hover:text-fg">&larr; Home</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">About this project</h1>
      <p className="mt-4 text-sm text-muted">
        Autonomous Adaptive Honeynet is a final-year project. Traffic enters through HAProxy and reaches decoy services running in a Kubernetes
        cluster. A collector turns their logs into events in MongoDB, maps them to MITRE ATT&amp;CK, and an API feeds this dashboard.
      </p>
      <h2 className="mt-10 text-lg font-semibold">Honest limits</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
        {LIMITS.map((l) => <li key={l}>{l}</li>)}
      </ul>
      <p className="mt-10 text-sm text-muted">
        Access is by approval only. <Link href="/signup" className="underline decoration-line-strong underline-offset-4 hover:text-fg">Request access</Link> or{" "}
        <Link href="/login" className="underline decoration-line-strong underline-offset-4 hover:text-fg">sign in</Link>.
      </p>
    </main>
  );
}