const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "05 Nov, 05:13" in UTC. The label always says UTC so nobody has to guess the time zone. */
export function formatTime(iso: string | Date): string {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())} ${months[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${months[m - 1]}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function relativeTime(iso: string | Date, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Last `days` calendar days (UTC) ending today, filling days with no events as 0. */
export function fillDays(rows: { day: string; count: number }[], days: number, today = new Date()) {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

/** Attacker text is only ever shown as plain text. Control characters (like terminal escape codes) are made visible, never run. */
export function visible(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}
