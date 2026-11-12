import type { Metadata } from "next";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { api, getCurrentUser } from "@/lib/api";
import type { AuditRow, PendingRequest, User } from "@/lib/types";
import { formatTime, relativeTime, visible } from "@/lib/format";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Empty, PageHeader, Panel } from "@/components/ui";
import { approveRequest, changeRole, rejectRequest, removeUser } from "./actions";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Settings" };

const DONE: Record<string, string> = {
  approved: "Account approved. The person can sign in now.",
  rejected: "Request rejected.",
  role: "Role changed. It applies at once.",
  removed: "User removed and signed out everywhere.",
};

const select = "smooth h-8 rounded-md border border-line-strong bg-bg px-2 text-sm text-fg outline-none focus:border-brand";
const smallBtn = "smooth h-8 rounded-md border border-line-strong bg-surface-2 px-3 text-xs font-medium text-fg hover:bg-line";

const CAN = {
  admin: [
    "Everything an analyst can do",
    "Approve or reject account requests",
    "Change roles and remove users",
    "See the audit log of admin actions",
  ],
  analyst: [
    "See every dashboard, attacker, session and technique",
    "Open attacker and session details",
    "Write incident reports (coming soon)",
    "Cannot manage users or see the audit log",
  ],
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await getCurrentUser();
  const { ok, error } = await searchParams;
  const isAdmin = me?.role === "admin";
  const now = Date.now();

  const [users, requests, audit] = isAdmin
    ? await Promise.all([api<User[]>("/users"), api<PendingRequest[]>("/users/requests"), api<AuditRow[]>("/audit")])
    : [[] as User[], [] as PendingRequest[], [] as AuditRow[]];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Settings" subtitle={isAdmin ? "Your account, and who can use this dashboard." : "Your account and what your role allows."} />

      {ok && DONE[ok] && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
          <CheckCircle size={18} weight="fill" /> {DONE[ok]}
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <WarningCircle size={18} /> Not done: {error.slice(0, 120)}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Your account" className="lg:col-span-2">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Username</dt><dd className="font-mono">{me?.username}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Role</dt><dd className="capitalize text-brand">{me?.role}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Sign-in</dt><dd className="text-right text-muted">8 hours, kept in an HTTP-only cookie</dd></div>
          </dl>
        </Panel>
        <Panel title="Change password" className="lg:col-span-3">
          <PasswordForm />
        </Panel>
      </div>

      <Panel title="What each role can do" hint={`you are ${me?.role}`}>
        <div className="grid gap-6 sm:grid-cols-2">
          {(["admin", "analyst"] as const).map((role) => (
            <div key={role} className={`rounded-lg border p-4 ${me?.role === role ? "border-brand/50 bg-brand/5" : "border-line"}`}>
              <h4 className="text-sm font-semibold capitalize">{role}{me?.role === role && <span className="ml-2 text-xs font-normal text-brand">you</span>}</h4>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {CAN[role].map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      {isAdmin && (
        <>
          <Panel title={`Account requests (${requests.length})`} hint="newest last" flush>
            {requests.length === 0 ? (
              <Empty title="No requests waiting">People ask for access from the Request an account link on the sign-in page.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {requests.map((r) => (
                  <li key={r.username} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm">{r.username}</div>
                      <div className="mt-1 text-xs text-faint">
                        Asked {relativeTime(r.created_at, now)}{r.reason ? <>: {visible(r.reason)}</> : ", no reason given"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={approveRequest} className="flex items-center gap-2">
                        <input type="hidden" name="username" value={r.username} />
                        <label className="sr-only" htmlFor={`role-${r.username}`}>Role for {r.username}</label>
                        <select id={`role-${r.username}`} name="role" defaultValue="analyst" className={select}>
                          <option value="analyst">Analyst</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button type="submit" className="smooth h-8 rounded-md bg-brand px-3 text-xs font-semibold text-bg hover:bg-brand-strong">Approve</button>
                      </form>
                      <form action={rejectRequest}>
                        <input type="hidden" name="username" value={r.username} />
                        <ConfirmSubmit message={`Reject the request from ${r.username}?`} className={smallBtn}>Reject</ConfirmSubmit>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Users (${users.length})`} flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-line text-xs text-faint">
                  <tr>
                    <th className="px-4 py-2 font-normal">Username</th>
                    <th className="px-4 py-2 font-normal">Role</th>
                    <th className="px-4 py-2 font-normal">Created</th>
                    <th className="px-4 py-2 font-normal">Last sign-in</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((u) => {
                    const self = u.username === me?.username;
                    return (
                      <tr key={u.username} className="smooth hover:bg-surface-2">
                        <td className="px-4 py-3 font-mono">{u.username}{self && <span className="ml-2 font-sans text-xs text-brand">you</span>}</td>
                        <td className="px-4 py-3">
                          {self ? (
                            <span className="capitalize text-muted">{u.role}</span>
                          ) : (
                            <form action={changeRole} className="flex items-center gap-2">
                              <input type="hidden" name="username" value={u.username} />
                              <label className="sr-only" htmlFor={`r-${u.username}`}>Role for {u.username}</label>
                              <select id={`r-${u.username}`} name="role" defaultValue={u.role} className={select}>
                                <option value="analyst">Analyst</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button type="submit" className={smallBtn}>Save</button>
                            </form>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{u.created_at ? formatTime(u.created_at) : "-"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{u.last_login ? relativeTime(u.last_login, now) : "never"}</td>
                        <td className="px-4 py-3 text-right">
                          {!self && (
                            <form action={removeUser}>
                              <input type="hidden" name="username" value={u.username} />
                              <ConfirmSubmit message={`Remove ${u.username}? They will be signed out everywhere.`} className="smooth h-8 rounded-md px-3 text-xs font-medium text-danger hover:bg-danger/10">Remove</ConfirmSubmit>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Audit log" hint="latest 20 admin actions" flush>
            {audit.length === 0 ? (
              <Empty title="Nothing yet">Approving, rejecting, role changes and removals are recorded here.</Empty>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {audit.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                    <span className="w-28 shrink-0 text-xs text-faint">{formatTime(a.time)} UTC</span>
                    <span><span className="font-mono">{a.actor}</span> <span className="text-muted">{a.action}</span> <span className="font-mono">{a.target}</span>{a.detail && <span className="text-faint"> ({a.detail})</span>}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
