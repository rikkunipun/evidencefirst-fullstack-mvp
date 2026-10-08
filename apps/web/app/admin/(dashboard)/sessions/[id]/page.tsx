import { notFound } from "next/navigation";
import { loadSessionSnapshot } from "@/lib/session-snapshot";
import { getServiceClient } from "@/lib/supabase/service-client";
import { SessionTrace } from "@/components/admin/SessionTrace";

export const dynamic = "force-dynamic";

export default async function AdminSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await loadSessionSnapshot(id);
  if (!snapshot) notFound();

  const supabase = getServiceClient();
  const { data: auditEvents } = await supabase
    .from("audit_events")
    .select("actor_type, actor_id, action, before, after, created_at")
    .eq("entity_id", id)
    .order("created_at", { ascending: true });

  return <SessionTrace sessionId={id} snapshot={snapshot} auditEvents={auditEvents ?? []} />;
}
