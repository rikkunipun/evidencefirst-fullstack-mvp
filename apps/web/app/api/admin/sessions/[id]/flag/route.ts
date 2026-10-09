import { NextResponse, type NextRequest } from "next/server";
import { requireResearcherOrResponse } from "@/lib/require-researcher-api";
import { getServiceClient } from "@/lib/supabase/service-client";
import { adminFlagSchema } from "@/lib/zod/requests";
import { recordAuditEvent } from "@/lib/audit";

/**
 * Item 10: admin stays for inspection, export, and post-hoc flagging only
 * in auto mode. This is that flagging path — works on any session in any
 * state, never blocks or changes delivery, purely a researcher note for
 * later audit. Distinct from needs_researcher_review (participant-
 * initiated, from the discovery recovery screen).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const researcher = await requireResearcherOrResponse();
  if (researcher instanceof NextResponse) return researcher;
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = adminFlagSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("id, researcher_flagged").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await supabase.from("sessions").update({ researcher_flagged: parsed.data.flagged, researcher_flag_note: parsed.data.note ?? null }).eq("id", id);
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

  await recordAuditEvent({
    actorType: "researcher",
    actorId: researcher.email,
    action: parsed.data.flagged ? "post_hoc_flagged" : "post_hoc_unflagged",
    entityType: "sessions",
    entityId: id,
    after: { flagged: parsed.data.flagged, note: parsed.data.note ?? null },
  });

  return NextResponse.json({ ok: true });
}
