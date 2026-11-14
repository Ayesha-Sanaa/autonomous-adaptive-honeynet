import { cookies } from "next/headers";
import { COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

const API_BASE = process.env.HONEYNET_API_URL || "http://localhost:3001";

export async function GET(req: Request) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return new Response("not signed in", { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return new Response("api unreachable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response("stream unavailable", { status: 502 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}