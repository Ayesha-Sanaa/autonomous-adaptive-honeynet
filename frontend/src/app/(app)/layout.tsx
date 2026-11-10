import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";

// Every page inside (app) needs a valid session; otherwise the visitor goes to the login page.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
