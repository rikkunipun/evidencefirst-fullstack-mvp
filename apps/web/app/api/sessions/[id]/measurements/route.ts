import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { measurementSchema } from "@/lib/zod/requests";
import { generateCapabilityToken, hashToken } from "@/lib/capability";
import { computeFollowupDueAt } from "@/lib/followup";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";
import { getEnv } from "@/lib/env";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = measurementSchema.safeParse({ ...json, phase: "post_evidence" });
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "ack_recorded") return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });

  const { data: delivery } = await supabase.from("deliveries").select("displayed_ack_at, delivered_at").eq("session_id", id).maybeSingle();
  if (!delivery?.displayed_ack_at) {
    return NextResponse.json({ error: "invalid_state", details: "delivery must be acknowledged before a post-score can be recorded" }, { status: 409 });
  }

  const { error: measurementError } = await supabase
    .from("measurements")
    .insert({ session_id: id, phase: "post_evidence", score: parsed.data.score, explanation: parsed.data.explanation ?? null, reported_behavior: parsed.data.reportedBehavior ?? null });
  if (measurementError) {
    // unique(session_id, phase) means a genuine double-submit (e.g. a
    // retried request) can never record twice — the loser hits a
    // unique-violation, not a duplicate measurement.
    if (measurementError.code === "23505") return NextResponse.json({ error: "already_measured", details: "post-evidence score already recorded" }, { status: 409 });
    // Tier 2 item 11: measurements_block_if_withdrawn (migration 0017)
    // raises inside the INSERT itself if the participant withdrew between
    // our session read above and this write — checked atomically in the
    // same statement.
    if (measurementError.message.includes("was withdrawn")) {
      return NextResponse.json({ error: "invalid_state", details: "participant withdrew before this could be recorded" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const rawToken = generateCapabilityToken();
  const dueAt = computeFollowupDueAt(new Date(delivery.delivered_at));
  const { error: followupError } = await supabase.from("followups").insert({ session_id: id, due_at: dueAt.toISOString(), token_hash: hashToken(rawToken) });
  if (followupError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const t = await transitionSession(supabase, id, "ack_recorded", session.revision, ["measured", "followup_due"]);
  if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });

  await recordAuditEvent({ actorType: "participant", action: "post_evidence_measured", entityType: "sessions", entityId: id, after: { score: parsed.data.score, dueAt: dueAt.toISOString() } });

  const followupUrl = `${getEnv().NEXT_PUBLIC_APP_URL}/follow-up/${rawToken}`;
  return NextResponse.json({ ok: true, followupUrl, dueAt: dueAt.toISOString() });
}
