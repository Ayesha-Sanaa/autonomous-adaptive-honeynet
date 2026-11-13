"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SquaresFour, Pulse, Crosshair, TerminalWindow, Target, HardDrives, GearSix, Sparkle, SignOut,
} from "@phosphor-icons/react";
import { Brand } from "./logo";
import { logout } from "@/app/actions";
import type { User } from "@/lib/types";

// A page is added here only when it exists.
const NAV = [
  { href: "/dashboard", label: "Overview", icon: SquaresFour },
  { href: "/dashboard/events", label: "Events", icon: Pulse },
  { href: "/dashboard/attackers", label: "Attackers", icon: Crosshair },
  { href: "/dashboard/sessions", label: "Sessions", icon: TerminalWindow },
  { href: "/dashboard/mitre", label: "MITRE ATT&CK", icon: Target },
  { href: "/dashboard/decoys", label: "Decoys", icon: HardDrives },
  { href: "/dashboard/adaptive", label: "Adaptive Engine", icon: Sparkle },
];
const SETTINGS = { href: "/dashboard/settings", label: "Settings", icon: GearSix };

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

type Item = { href: string; label: string; icon: typeof SquaresFour };

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      className={`smooth flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium max-lg:justify-center ${
        active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      <Icon size={18} weight={active ? "fill" : "regular"} className={`shrink-0 ${active ? "text-brand" : ""}`} />
      <span className="max-lg:hidden">{item.label}</span>
    </Link>
  );
}

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-surface p-3 max-lg:w-16">
      <div className="px-2 max-lg:flex max-lg:justify-center">
        <span className="max-lg:hidden"><Brand /></span>
        <span className="hidden max-lg:block"><Brand compact /></span>
      </div>

      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto" aria-label="Main">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <div className="mb-3">
        <NavLink item={SETTINGS} active={isActive(pathname, SETTINGS.href)} />
      </div>

      <div className="border-t border-line pt-3">
        <div className="flex items-center gap-3 px-2 max-lg:justify-center">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-sm font-semibold uppercase">
            {user.username[0]}
          </div>
          <div className="min-w-0 max-lg:hidden">
            <div className="truncate text-sm font-medium">{user.username}</div>
            <div className="text-xs capitalize text-muted">{user.role}</div>
          </div>
        </div>
        <form action={logout} className="mt-2">
          <button
            type="submit"
            title="Sign out"
            className="smooth flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg max-lg:justify-center"
          >
            <SignOut size={18} className="shrink-0" />
            <span className="max-lg:hidden">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
