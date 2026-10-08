import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { measurementSchema } from "@/lib/zod/requests";
import { canProceedPastCrux, type CruxPassRecord, type CruxClassification } from "@/lib/crux";
import { getEnabledPackForTopic, PROTOCOL_VERSION } from "@/lib/evidence";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = measurementSchema.safeParse({ ...json, phase: "pre_evidence" });
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision, pack_topic").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "crux") return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });

  // Re-verify the crux carried a checkable current/near-term reason — never trust the client's claim alone.
  const { data: baseline } = await supabase.from("baseline_snapshots").select("baseline_score").eq("session_id", id).maybeSingle();
  const { data: passesRaw } = await supabase.from("crux_passes").select("id, pass_number, confirmed_reason, hypothetical_score").eq("session_id", id).order("pass_number");
  const { data: classificationsRaw } = await supabase.from("crux_classifications").select("classification, crux_pass_id").eq("session_id", id);
  if (!baseline || !passesRaw) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const carryingPass = passesRaw.find((p) => p.confirmed_reason && p.hypothetical_score !== null && p.hypothetical_score < baseline.baseline_score);
  const classification = classificationsRaw?.find((c) => c.crux_pass_id === carryingPass?.id)?.classification as CruxClassification | undefined;
  const carryingRecord: CruxPassRecord | null = carryingPass
    ? { passNumber: carryingPass.pass_number as 1 | 2, confirmedReason: carryingPass.confirmed_reason, hypotheticalScore: carryingPass.hypothetical_score }
    : null;
  if (!canProceedPastCrux(carryingRecord, classification ?? null)) {
    return NextResponse.json({ error: "invalid_state", details: "crux did not produce a checkable, load-bearing reason" }, { status: 409 });
  }

  const pack = getEnabledPackForTopic(session.pack_topic ?? "");
  if (!pack) return NextResponse.json({ error: "invalid_state", details: "no enabled evidence pack for this topic" }, { status: 409 });

  const { error: measurementError } = await supabase.from("measurements").insert({ session_id: id, phase: "pre_evidence", score: parsed.data.score, explanation: parsed.data.explanation ?? null });
  if (measurementError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const { data: assignResult, error: assignError } = await supabase.rpc("assign_condition", {
    p_session_id: id,
    p_pack_id: pack.id,
    p_pack_version: pack.version,
    p_protocol_version: PROTOCOL_VERSION,
    p_block_size: 10,
  });
  if (assignError || !assignResult?.[0]) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const t = await transitionSession(supabase, id, "crux", session.revision, ["pre_evidence_recorded", "assigned"]);
  if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });

  await recordAuditEvent({
    actorType: "system",
    action: "assigned",
    entityType: "sessions",
    entityId: id,
    after: { condition: assignResult[0].condition, packId: pack.id, packVersion: pack.version },
  });

  return NextResponse.json({ ok: true, condition: assignResult[0].condition });
}
