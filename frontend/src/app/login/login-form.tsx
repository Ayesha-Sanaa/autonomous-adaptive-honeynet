"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeSlash, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { login, type LoginState } from "../actions";

const initial: LoginState = { error: null, username: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="smooth flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-semibold text-bg hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (<><SpinnerGap size={16} className="animate-spin" /> Signing in</>) : "Sign in"}
    </button>
  );
}

const field =
  "smooth h-10 w-full rounded-md border border-line-strong bg-bg px-3 text-sm text-fg placeholder:text-faint outline-none focus:border-brand";

export function LoginForm() {
  const [state, formAction] = useActionState(login, initial);
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="mt-8 space-y-6" noValidate>
      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-3 text-sm text-danger">
          <WarningCircle size={16} className="mt-0.5 shrink-0" />
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
            required className={`${field} pr-12`} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
            className="smooth absolute right-1 top-1 flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg">
            {show ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
