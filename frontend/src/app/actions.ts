"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiLogin, apiLogout, apiSignup } from "@/lib/api";
import { COOKIE, getToken } from "@/lib/session";

export type LoginState = { error: string | null; username: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password.", username };

  const result = await apiLogin(username, password);
  if (!result.ok) {
    return {
      error:
        result.reason === "invalid"
          ? "Invalid username or password."
          : "Cannot reach the honeynet API right now. Try again in a moment.",
      username,
    };
  }

  (await cookies()).set(COOKIE, result.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(result.expiresAt),
  });
  redirect("/dashboard");
}

export async function logout() {
  const token = await getToken();
  if (token) await apiLogout(token);
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

export async function toggleDemoMode(enabled: boolean) {
  const c = await cookies();
  if (enabled) {
    c.set("demo_mode", "1", { path: "/", sameSite: "strict" });
  } else {
    c.delete("demo_mode");
  }
  redirect("/dashboard");
}

export type SignupState = { error: string | null; done: boolean; username: string; reason: string };

export async function signup(_prev: SignupState, form: FormData): Promise<SignupState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const again = String(form.get("again") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200);
  const fail = (error: string): SignupState => ({ error, done: false, username, reason });

  if (!username || !password) return fail("Enter a username and a password.");
  if (password !== again) return fail("The two passwords do not match.");

  const result = await apiSignup({ username, password, reason });
  if (!result.ok) return fail(result.error);
  return { error: null, done: true, username: "", reason: "" };
}
