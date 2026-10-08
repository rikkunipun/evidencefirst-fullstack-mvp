import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { eligibilityAnswersSchema } from "@/lib/zod/requests";
import { evaluateEligibility, RULES_VERSION } from "@/lib/eligibility";
import { getEnabledPackForTopic } from "@/lib/evidence";
import { mergeFields, type FieldMap } from "@/lib/extraction-merge";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = eligibilityAnswersSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision, pack_topic").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "eligibility_check") return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });

  const { data: confirmation } = await supabase
    .from("belief_confirmations")
    .select("id, confirmed_wording")
    .eq("session_id", id)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!confirmation?.confirmed_wording) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const { data: extractionHistory } = await supabase.from("extraction_snapshots").select("fields, safety").eq("session_id", id).order("created_at", { ascending: true });
  const fields = mergeFields((extractionHistory ?? []).map((r) => r.fields as FieldMap));
  const latestSafety = extractionHistory && extractionHistory.length > 0 ? extractionHistory[extractionHistory.length - 1].safety : "in_scope";

  const checkableViaPackOrTest = getEnabledPackForTopic(session.pack_topic ?? "") !== null;
  const withinSafeScope = latestSafety === "stop" ? false : latestSafety === "in_scope" ? true : null;

  const result = evaluateEligibility({
    hasConfirmedWording: true,
    stillHoldsBelief: body.stillHoldsBelief,
    chosenAction: fields.chosen_action,
    rejectedAlternative: fields.rejected_alternative,
    expectedOutcome: fields.expected_outcome,
    scopeAndTime: body.scopeAndTime,
    materiallyAffectedDecision: body.materiallyAffectedDecision,
    consequenceOccurred: body.consequenceOccurred,
    consequenceEvidence: body.consequenceEvidence ?? null,
    checkableViaPackOrTest,
    withinSafeScope,
  });

  const { error: insertError } = await supabase.from("eligibility_evaluations").insert({
    session_id: id,
    belief_confirmation_id: confirmation.id,
    current_status: result.current.status,
    specific_status: result.specific.status,
    causal_status: result.causal.status,
    consequential_status: result.consequential.status,
    checkable_status: result.checkable.status,
    safe_status: result.safe.status,
    reasons: {
      current: result.current.reason,
      specific: result.specific.reason,
      causal: result.causal.reason,
      consequential: result.consequential.reason,
      checkable: result.checkable.reason,
      safe: result.safe.reason,
    },
    rules_version: RULES_VERSION,
    disposition: result.disposition,
    scope_and_time: body.scopeAndTime,
    consequence_occurred: body.consequenceOccurred,
    consequence_evidence: body.consequenceEvidence ?? null,
  });
  if (insertError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  if (result.disposition === "parked") {
    const failedReasons = [result.current, result.specific, result.causal, result.consequential, result.checkable, result.safe]
      .filter((g) => g.status !== "pass")
      .map((g) => g.reason)
      .join(" ");
    const t = await transitionSession(supabase, id, "eligibility_check", session.revision, ["parked"], { park_reason: failedReasons });
    if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
  }

  await recordAuditEvent({ actorType: "system", action: "eligibility_evaluated", entityType: "sessions", entityId: id, after: result });

  return NextResponse.json({ disposition: result.disposition, gates: result });
}
