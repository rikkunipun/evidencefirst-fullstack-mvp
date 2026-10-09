import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { recordAuditEvent } from "@/lib/audit";

/**
 * Participant-initiated flag from the discovery recovery screen ("ask for
 * researcher review"). Does not change session state or bypass any gate —
 * it only surfaces the session in the admin view so a researcher can look
 * at it. Idempotent: asking twice is a no-op, not an error.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("id, needs_researcher_review").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!session.needs_researcher_review) {
    await supabase.from("sessions").update({ needs_researcher_review: true }).eq("id", id);
    await recordAuditEvent({ actorType: "participant", action: "requested_researcher_review", entityType: "sessions", entityId: id });
  }

  return NextResponse.json({ ok: true });
}
