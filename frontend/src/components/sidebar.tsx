"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut } from "lucide-react";
import { Brand } from "./logo";
import { logout } from "@/app/actions";
import type { User } from "@/lib/types";

// Pages are added here as they are built.
const NAV = [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }];

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-5 max-lg:w-[68px]">
      <div className="px-2 max-lg:flex max-lg:justify-center"><span className="max-lg:hidden"><Brand /></span><span className="hidden max-lg:block"><Brand compact /></span></div>

      <nav className="mt-8 flex-1 space-y-1" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} title={label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition max-lg:justify-center ${
                active ? "bg-brand/10 font-medium text-brand" : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}>
              <Icon className="size-[18px] shrink-0" />
              <span className="max-lg:hidden">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-3 px-2 max-lg:justify-center">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold uppercase text-brand">
            {user.username[0]}
          </div>
          <div className="min-w-0 max-lg:hidden">
            <div className="truncate text-sm font-medium">{user.username}</div>
            <div className="text-xs capitalize text-muted">{user.role}</div>
          </div>
        </div>
        <form action={logout} className="mt-3">
          <button type="submit" title="Sign out"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-fg max-lg:justify-center">
            <LogOut className="size-[18px] shrink-0" />
            <span className="max-lg:hidden">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
