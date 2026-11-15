"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";

const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();

export type ReportState = { error: string | null; done: boolean };

export async function createReport(_prev: ReportState, f: FormData): Promise<ReportState> {
  const body = {
    title: text(f, "title"),
    notes: text(f, "notes"),
    severity: text(f, "severity"),
    src_ip: text(f, "src_ip"),
  };
  if (!body.title || !body.notes) return { error: "Fill in the title and the notes.", done: false };
  try {
    await api("/reports", { method: "POST", body: JSON.stringify(body) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong", done: false };
  }
  revalidatePath("/dashboard/reports");
  return { error: null, done: true };
}

export async function deleteReport(f: FormData) {
  const id = text(f, "id");
  if (!id) return;
  try {
    await api(`/reports/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    // the API refuses anyone who is not an admin
  }
  revalidatePath("/dashboard/reports");
}