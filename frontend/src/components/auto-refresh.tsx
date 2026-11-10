"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the page's server data every few seconds so the dashboard stays live without a manual reload.
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
