import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { cruxRequestSchema } from "@/lib/zod/requests";
import { decideNextCruxStep, canProceedPastCrux, type CruxPassRecord } from "@/lib/crux";
import { classifyCruxReason } from "@/lib/ai/crux-classifier";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";
import { MAX_CRUX_PASSES } from "@/lib/constants";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = cruxRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "crux") return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });

  const { data: baseline } = await supabase.from("baseline_snapshots").select("belief_wording, baseline_score").eq("session_id", id).maybeSingle();
  if (!baseline) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const { data: passesRaw } = await supabase
    .from("crux_passes")
    .select("id, pass_number, stated_reason, confirmed_reason, hypothetical_score")
    .eq("session_id", id)
    .order("pass_number", { ascending: true });
  const passes = passesRaw ?? [];

  const body = parsed.data;

  if (body.action === "submit_reason") {
    if (passes.length >= MAX_CRUX_PASSES) return NextResponse.json({ error: "invalid_state", details: "crux passes exhausted" }, { status: 409 });
    const passNumber = passes.length + 1;
    const { error } = await supabase.from("crux_passes").insert({ session_id: id, pass_number: passNumber, stated_reason: body.reason });
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    return NextResponse.json({ passNumber, reflected: body.reason, nextStep: "confirm_reason" });
  }

  if (body.action === "confirm_reason") {
    const target = [...passes].reverse().find((p) => !p.confirmed_reason);
    if (!target) return NextResponse.json({ error: "invalid_state" }, { status: 409 });
    const { error } = await supabase.from("crux_passes").update({ confirmed_reason: body.confirmedReason }).eq("id", target.id);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    return NextResponse.json({ nextStep: "submit_hypothetical" });
  }

  // action === "submit_hypothetical"
  const target = [...passes].reverse().find((p) => p.confirmed_reason && p.hypothetical_score === null);
  if (!target) return NextResponse.json({ error: "invalid_state" }, { status: 409 });
  const { error: updateError } = await supabase.from("crux_passes").update({ hypothetical_score: body.hypotheticalScore }).eq("id", target.id);
  if (updateError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const updatedPasses: CruxPassRecord[] = passes.map((p) =>
    p.id === target.id
      ? { passNumber: p.pass_number as 1 | 2, confirmedReason: target.confirmed_reason, hypotheticalScore: body.hypotheticalScore }
      : { passNumber: p.pass_number as 1 | 2, confirmedReason: p.confirmed_reason, hypotheticalScore: p.hypothetical_score },
  );

  const decision = decideNextCruxStep({ baselineScore: baseline.baseline_score, passes: updatedPasses });

  if (decision.action === "ask_next_pass") {
    return NextResponse.json({ nextStep: "submit_reason", passNumber: decision.passNumber });
  }

  // decision.action === "stop"
  if (!decision.carryingPass) {
    const t = await transitionSession(supabase, id, "crux", session.revision, ["parked"], {
      park_reason: "Neither reason you gave would actually lower your confidence if it turned out to be false, so there's nothing load-bearing here to test.",
    });
    if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
    await recordAuditEvent({ actorType: "system", action: "parked_after_crux", entityType: "sessions", entityId: id });
    return NextResponse.json({ nextStep: "parked" });
  }

  const carryingPassRow = passes.find((p) => p.pass_number === decision.carryingPass!.passNumber) ?? target;
  const classification = await classifyCruxReason(baseline.belief_wording, decision.carryingPass.confirmedReason ?? "");
  await supabase.from("crux_classifications").insert({
    session_id: id,
    crux_pass_id: carryingPassRow.id,
    classification: classification.classification,
  });
  await recordAuditEvent({
    actorType: "model",
    action: "crux_classified",
    entityType: "crux_passes",
    entityId: carryingPassRow.id,
    after: { classification: classification.classification, model: classification.model, promptVersion: classification.promptVersion, latencyMs: classification.latencyMs, requestId: classification.requestId, error: classification.errorMessage },
  });

  const canProceed = canProceedPastCrux(decision.carryingPass, classification.classification);
  if (!canProceed) {
    const t = await transitionSession(supabase, id, "crux", session.revision, ["parked"], {
      park_reason: "Your reason looks more like a longer-term prediction, a personal value, or something we can't check yet with our current sources, rather than something checkable right now.",
    });
    if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
    return NextResponse.json({ nextStep: "parked", classification: classification.classification });
  }

  return NextResponse.json({ nextStep: "pre_evidence", classification: classification.classification, confirmedReason: decision.carryingPass.confirmedReason });
}
