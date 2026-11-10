import "server-only";
import { cookies } from "next/headers";

// The login token lives in an httpOnly cookie: the browser sends it but page scripts can never read it.
export const COOKIE = "honeynet_session";

export async function getToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}
