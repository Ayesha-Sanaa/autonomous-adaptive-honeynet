"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { login, type LoginState } from "../actions";

const initial: LoginState = { error: null, username: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-bg transition hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (<><Loader2 className="size-4 animate-spin" /> Signing in</>) : "Sign in"}
    </button>
  );
}

const field =
  "h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-sm text-fg placeholder:text-faint outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";

export function LoginForm() {
  const [state, formAction] = useActionState(login, initial);
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      {state.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">Username</label>
        <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
          autoFocus required defaultValue={state.username} className={field} />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password"
            required className={`${field} pr-11`} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-fg">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
