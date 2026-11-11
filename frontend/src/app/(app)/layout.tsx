import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { DemoBanner } from "@/components/demo-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const c = await cookies();
  const isDemo = c.get("demo_mode")?.value === "1";

  return (
    <div className="flex min-h-screen">
      <a
        href="#content"
        className="sr-only rounded-md bg-brand px-3 py-2 text-sm font-semibold text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      <Sidebar user={user} />
      <main id="content" className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        <DemoBanner isDemo={isDemo} />
        {children}
      </main>
    </div>
  );
}
