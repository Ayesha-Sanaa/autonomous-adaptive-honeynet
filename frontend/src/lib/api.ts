import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getToken } from "./session";
import type { User } from "./types";

const API_URL = process.env.API_URL ?? "http://api:3001";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call(path: string, init: RequestInit & { token?: string | null } = {}) {
  const { token, ...rest } = init;
  
  // Demo mode cookie check
  const isDemo = cookies().get("demo_mode")?.value === "1";
  let finalPath = path;
  
  if (isDemo && (path.startsWith("/events") || path.startsWith("/stats") || path.startsWith("/attackers") || path.startsWith("/sessions"))) {
    finalPath += path.includes("?") ? "&data=demo" : "?data=demo";
  }

  return fetch(API_URL + finalPath, {
    ...rest,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function api<T>(path: string): Promise<T> {
  const res = await call(path, { token: await getToken() });
  if (res.status === 401) redirect("/login");
  if (!res.ok) throw new ApiError(res.status, `API ${path} answered ${res.status}`);
  return res.json() as Promise<T>;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await call("/auth/me", { token });
    if (!res.ok) return null;
    return ((await res.json()) as { user: User }).user;
  } catch {
    return null;
  }
});

export type LoginResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; reason: "invalid" | "unreachable" };

export async function apiLogin(username: string, password: string): Promise<LoginResult> {
  try {
    const res = await call("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    if (res.status === 401 || res.status === 400) return { ok: false, reason: "invalid" };
    if (!res.ok) return { ok: false, reason: "unreachable" };
    const data = (await res.json()) as { token: string; expires_at: string };
    return { ok: true, token: data.token, expiresAt: data.expires_at };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

export async function apiLogout(token: string) {
  try {
    await call("/auth/logout", { method: "POST", token });
  } catch {}
}
