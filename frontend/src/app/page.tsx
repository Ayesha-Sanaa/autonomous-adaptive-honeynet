import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";

export default async function Home() {
  redirect((await getCurrentUser()) ? "/dashboard" : "/login");
}
