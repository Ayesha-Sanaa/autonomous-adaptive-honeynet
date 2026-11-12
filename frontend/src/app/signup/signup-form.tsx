"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle, Eye, EyeSlash, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { signup, type SignupState } from "../actions";

const initial: SignupState = { error: null, done: false, username: "", reason: "" };

const field =
  "smooth h-11 w-full rounded-md border border-line-strong bg-bg px-3 text-sm text-fg placeholder:text-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="smooth flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-bg hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <SpinnerGap size={16} className="animate-spin" /> Sending
        </>
      ) : (
        "Send request"
      )}
    </button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState(signup, initial);
  const [show, setShow] = useState(false);

  if (state.done) {
    return (
      <div role="status" className="mt-8 rounded-md border border-ok/40 bg-ok/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-ok">
          <CheckCircle size={18} weight="fill" /> Request sent
        </p>
        <p className="mt-2 text-muted">An admin has to approve it before you can sign in. Ask them to check the Settings page.</p>
        <Link href="/login" className="smooth mt-4 inline-block font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-3 text-sm text-danger">
          <WarningCircle size={16} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">Username</label>
        <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required
          defaultValue={state.username} aria-describedby="username-hint" className={field} />
        <p id="username-hint" className="text-xs text-faint">3 to 32 characters: letters, digits, dot, dash or underscore.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="new-password" required aria-describedby="password-hint" className={`${field} pr-20`} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide passwords" : "Show passwords"}
            aria-pressed={show}
            className="smooth absolute right-1 top-1 flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            {show ? <EyeSlash size={16} /> : <Eye size={16} />}
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <p id="password-hint" className="text-xs text-faint">At least 12 characters, and it must not contain your username.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="again" className="text-sm font-medium">Repeat password</label>
        <input id="again" name="again" type={show ? "text" : "password"} autoComplete="new-password" required className={field} />
      </div>

      <div className="space-y-2">
        <label htmlFor="reason" className="text-sm font-medium">Why do you need access? <span className="font-normal text-faint">(optional)</span></label>
        <textarea id="reason" name="reason" rows={2} maxLength={200} defaultValue={state.reason}
          className={`${field} h-auto py-2.5`} />
      </div>

      <SubmitButton />
    </form>
  );
}
