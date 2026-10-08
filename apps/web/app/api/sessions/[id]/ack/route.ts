import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "delivered") return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });

  const { data: delivery } = await supabase.from("deliveries").select("displayed_ack_at").eq("session_id", id).maybeSingle();
  if (!delivery) return NextResponse.json({ error: "server_error" }, { status: 500 });

  if (!delivery.displayed_ack_at) {
    const { error } = await supabase.from("deliveries").update({ displayed_ack_at: new Date().toISOString() }).eq("session_id", id);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const t = await transitionSession(supabase, id, "delivered", session.revision, ["ack_recorded"]);
  if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });

  await recordAuditEvent({ actorType: "participant", action: "delivery_acknowledged", entityType: "sessions", entityId: id });

  return NextResponse.json({ ok: true });
}
