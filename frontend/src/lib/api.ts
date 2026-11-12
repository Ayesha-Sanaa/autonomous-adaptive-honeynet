import { cookies } from "next/headers";
import { COOKIE } from "./session";

const API_BASE = process.env.HONEYNET_API_URL || "http://localhost:3001";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Pass demo mode cookie to backend as query parameter if set
  const isDemo = cookieStore.get("demo_mode")?.value === "1";
  let url = `${API_BASE}${path}`;
  if (isDemo && !path.includes("data=demo")) {
    url += path.includes("?") ? "&data=demo" : "?data=demo";
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers, cache: "no-store" });
  } catch {
    throw new Error("API unreachable");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) throw new Error("API sent an empty answer");
  return JSON.parse(text) as T;
}

export async function apiLogin(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) return { ok: false as const, reason: "invalid" as const };
    return { ok: false as const, reason: "unreachable" as const };
  }

  const data = await res.json();
  return { ok: true as const, token: data.token as string, expiresAt: data.expiresAt as string };
}

export async function apiSignup(body: { username: string; password: string; reason: string }) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false as const, error: "Cannot reach the honeynet API right now. Try again in a moment." };
  }
  if (res.ok) return { ok: true as const };
  const err = await res.json().catch(() => ({}));
  return { ok: false as const, error: typeof err.error === "string" ? err.error : "The request could not be sent." };
}

export async function apiLogout(token: string) {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => {});
}

export async function getCurrentUser() {
  try {
    const data = await api<{ user: { username: string; role: "admin" | "analyst"; must_change_password?: boolean } }>("/auth/me");
    return data.user;
  } catch {
    return null;
  }
}