"use client";

import type { ReactNode } from "react";

/** A submit button that asks "are you sure?" first. Cancel leaves the form unsent. */
export function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
