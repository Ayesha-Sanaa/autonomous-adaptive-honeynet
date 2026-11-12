"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { changePassword, type PasswordState } from "./actions";

const initial: PasswordState = { error: null, done: false };
const field = "smooth h-10 w-full rounded-md border border-line-strong bg-bg px-3 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="smooth h-10 rounded-md bg-brand px-4 text-sm font-semibold text-bg hover:bg-brand-strong disabled:opacity-70">
      {pending ? "Saving" : "Change password"}
    </button>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <WarningCircle size={16} className="mt-0.5 shrink-0" /> <span>{state.error}</span>
        </div>
      )}
      {state.done && (
        <div role="status" className="flex items-start gap-2 rounded-md border border-ok/40 bg-ok/10 px-3 py-2.5 text-sm text-ok">
          <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0" /> <span>Password changed. Your other sign-ins were closed.</span>
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="current" className="text-sm font-medium">Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={field} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="next" className="text-sm font-medium">New password</label>
          <input id="next" name="next" type="password" autoComplete="new-password" required className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="again" className="text-sm font-medium">Repeat new password</label>
          <input id="again" name="again" type="password" autoComplete="new-password" required className={field} />
        </div>
      </div>
      <p className="text-xs text-faint">At least 12 characters, and it must not contain your username.</p>
      <Save />
    </form>
  );
}
