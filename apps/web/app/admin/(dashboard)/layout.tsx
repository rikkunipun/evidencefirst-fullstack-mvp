import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireResearcher } from "@/lib/supabase/admin-auth";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const researcher = await requireResearcher();
  if (!researcher) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-[var(--ef-bg)]">
      <AdminNav email={researcher.email} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
