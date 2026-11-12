"use server";

import { redirect } from "next/navigation";
import { api } from "@/lib/api";

const text = (f: FormData, key: string) => String(f.get(key) ?? "");
const enc = encodeURIComponent;

// Runs one admin call, then returns to Settings with a short result. The API still checks that the caller is an admin.
async function run(path: string, method: "POST" | "DELETE", body: object | undefined, done: string): Promise<never> {
  let error: string | null = null;
  try {
    await api(path, { method, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong";
  }
  redirect(error ? `/dashboard/settings?error=${enc(error.slice(0, 120))}` : `/dashboard/settings?ok=${done}`);
}

export async function approveRequest(f: FormData) {
  await run(`/users/requests/${enc(text(f, "username"))}/approve`, "POST", { role: text(f, "role") }, "approved");
}

export async function rejectRequest(f: FormData) {
  await run(`/users/requests/${enc(text(f, "username"))}`, "DELETE", undefined, "rejected");
}

export async function changeRole(f: FormData) {
  await run(`/users/${enc(text(f, "username"))}/role`, "POST", { role: text(f, "role") }, "role");
}

export async function removeUser(f: FormData) {
  await run(`/users/${enc(text(f, "username"))}`, "DELETE", undefined, "removed");
}

export type PasswordState = { error: string | null; done: boolean };

export async function changePassword(_prev: PasswordState, f: FormData): Promise<PasswordState> {
  const current = text(f, "current");
  const next = text(f, "next");
  if (!current || !next) return { error: "Fill in every field.", done: false };
  if (next !== text(f, "again")) return { error: "The two new passwords do not match.", done: false };
  try {
    await api("/auth/password", { method: "POST", body: JSON.stringify({ current, next }) });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong", done: false };
  }
  return { error: null, done: true };
}
