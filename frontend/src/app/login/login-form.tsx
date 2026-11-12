"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Eye, EyeSlash, Lock, SpinnerGap, User, WarningCircle } from "@phosphor-icons/react";
import { login, type LoginState } from "../actions";

const initial: LoginState = { error: null, username: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="smooth group flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-bg hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <SpinnerGap size={16} className="animate-spin" /> Signing in
        </>
      ) : (
        <>
          Sign in
          <ArrowRight size={16} weight="bold" className="smooth group-hover:translate-x-1" />
        </>
      )}
    </button>
  );
}

const field =
  "smooth h-11 w-full rounded-md border border-line-strong bg-bg pl-10 pr-3 text-sm text-fg placeholder:text-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function LoginForm() {
  const [state, formAction] = useActionState(login, initial);
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);

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
        <div className="relative">
          <User size={16} className="pointer-events-none absolute left-3 top-3.5 text-faint" />
          <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
            autoFocus required defaultValue={state.username} className={field} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <div className="relative">
          <Lock size={16} className="pointer-events-none absolute left-3 top-3.5 text-faint" />
          <input
            id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required
            onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
            onKeyDown={(e) => setCaps(e.getModifierState("CapsLock"))}
            onBlur={() => setCaps(false)}
            className={`${field} pr-20`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="smooth absolute right-1 top-1 flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            {show ? <EyeSlash size={16} /> : <Eye size={16} />}
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {caps && <p className="text-xs text-warn">Caps Lock is on.</p>}
      </div>

      <SubmitButton />
    </form>
  );
}
