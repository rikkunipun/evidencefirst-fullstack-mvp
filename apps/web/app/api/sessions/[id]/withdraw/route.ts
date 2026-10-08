import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { withdrawSchema } from "@/lib/zod/requests";
import { isTerminal, type SessionState } from "@/lib/state-machine";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => ({}));
  const parsed = withdrawSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (isTerminal(session.state as SessionState)) {
    // Already terminal (including already withdrawn); withdrawal is idempotent, not an error.
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("sessions")
    .update({ state: "withdrawn", withdrawn_at: new Date().toISOString(), withdrawal_reason: parsed.data.reason ?? null, revision: session.revision + 1 })
    .eq("id", id)
    .eq("revision", session.revision);
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

  await supabase.from("consent_events").update({ withdrawn_at: new Date().toISOString(), withdrawal_reason: parsed.data.reason ?? null }).eq("session_id", id);

  await recordAuditEvent({ actorType: "participant", action: "withdrawn", entityType: "sessions", entityId: id });

  return NextResponse.json({ ok: true });
}
