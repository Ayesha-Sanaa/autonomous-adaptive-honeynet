import type { Metadata } from "next";
import { getCurrentUser, api } from "@/lib/api";
import type { User } from "@/lib/types";
import { PageHeader, Panel, StatCell, Empty } from "@/components/ui";

export const metadata: Metadata = { title: "Settings & Profile" };

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  let users: User[] = [];

  if (currentUser?.role === "admin") {
    try {
      users = await api<User[]>("/users");
    } catch {
      users = [];
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Settings & Account Management"
        subtitle="Manage authentication profile, security credentials, and system access access control."
      />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-3">
        <StatCell label="Logged In User" value={currentUser?.username ?? "Unknown"} note="Active Session" />
        <StatCell label="Assigned Role" value={currentUser?.role?.toUpperCase() ?? "ANALYST"} note="Access Control Level" />
        <StatCell label="Auth Strategy" value="JWT / HTTP-Only Cookie" note="Session Secure" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="User Profile Credentials">
          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-muted">Username</span>
              <span className="font-mono font-semibold text-fg">{currentUser?.username}</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-muted">Role Permissions</span>
              <span className="font-mono text-brand font-semibold">{currentUser?.role}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-muted">Password Status</span>
              <span className="text-xs text-ok font-medium">Configured / Active</span>
            </div>
          </div>
        </Panel>

        <Panel title="Security Controls">
          <p className="text-sm text-muted mb-4">
            Security tokens are strictly stored inside encrypted HTTP-Only cookies to prevent XSS credential theft.
          </p>
          <div className="rounded bg-surface-2 p-3 text-xs text-faint font-mono">
            SameSite: Strict | Secure: Production | Scope: /dashboard
          </div>
        </Panel>
      </div>

      {currentUser?.role === "admin" && (
        <Panel title={`System Accounts Directory (${users.length})`} hint="Admin View" flush>
          {users.length === 0 ? (
            <Empty title="No additional users configured" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs text-faint">
                  <tr>
                    <th className="px-4 py-2 font-normal">Username</th>
                    <th className="px-4 py-2 font-normal">Role</th>
                    <th className="px-4 py-2 font-normal">Must Change Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((u) => (
                    <tr key={u.username} className="smooth hover:bg-surface-2">
                      <td className="px-4 py-3 font-mono font-medium">{u.username}</td>
                      <td className="px-4 py-3 font-mono text-xs text-brand">{u.role}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {u.must_change_password ? "Yes" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}