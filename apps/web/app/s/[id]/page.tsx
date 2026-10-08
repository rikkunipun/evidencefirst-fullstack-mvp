import { redirect } from "next/navigation";
import { requireSessionAccess } from "@/lib/session-auth";
import { loadSessionSnapshot } from "@/lib/session-snapshot";
import { SessionView } from "@/components/participant/SessionView";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authorized = await requireSessionAccess(id);
  if (!authorized) redirect("/participate");

  const snapshot = await loadSessionSnapshot(id);
  if (!snapshot) redirect("/participate");

  return <SessionView sessionId={id} initialSnapshot={snapshot} />;
}
