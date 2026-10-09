import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { getEnv } from "@/lib/env";
import { getEnabledPackForTopic, selectClaims } from "@/lib/evidence";
import { getPackPolicy } from "@/lib/pack-policy";
import { PACK_POLICY_VERSION } from "@/lib/pack-policy";
import { classifyClaim, validateClassification } from "@/lib/ai/claim-classifier";
import { CLAIM_KIND_CLARIFICATION_QUESTION } from "@/lib/ai/claim-classifier-pure";
import { decideAutoDeliveryOutcome } from "@/lib/auto-delivery-decision";
import { composeDelivery, DELIVERY_TEMPLATE_VERSION } from "@/lib/delivery-template";
import { computeContentHash } from "@/lib/content-hash";
import { legacyDisposition } from "@/lib/approval-disposition";
import { transitionSession } from "@/lib/session-transition";
import { assertTransition } from "@/lib/state-machine";
import { recordAuditEvent } from "@/lib/audit";

const bodySchema = z.object({ clarificationAnswer: z.string().trim().max(500).optional() });

// Non-delivery wording for an unclassifiable claim — never "preference",
// never implies a human will look at it. Exact text per item 3.
const NO_SUITABLE_EVIDENCE_REASON = "We don't have suitable verified evidence for this exact claim.";

const ENTRY_STATES = new Set(["assigned", "pending_review", "approved"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (getEnv().DELIVERY_MODE !== "auto") {
    return NextResponse.json({ error: "invalid_state", details: "automatic delivery is not enabled" }, { status: 409 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("state, revision, pack_topic, withdrawn_at, claim_kind_clarification_question, claim_kind_clarification_asked")
    .eq("id", id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Item 5: re-check consent/withdrawal before doing anything else.
  if (session.withdrawn_at) {
    return NextResponse.json({ error: "invalid_state", details: "participant withdrew" }, { status: 409 });
  }

  // Idempotent fast path (items 5 & 9): a session that already has a
  // delivery — whether from this flow or a resumed old manual one — is
  // reported as already delivered, never re-processed.
  const { data: existingDelivery } = await supabase.from("deliveries").select("exact_text").eq("session_id", id).maybeSingle();
  if (existingDelivery) {
    return NextResponse.json({ outcome: "delivered" });
  }

  if (!ENTRY_STATES.has(session.state)) {
    return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });
  }

  // Item 5: re-check claim, baseline, eligibility inside this flow (not
  // just trusting that gates passed earlier are still the current truth).
  const { data: confirmation } = await supabase
    .from("belief_confirmations")
    .select("confirmed_wording, confirmed_empirical_claim")
    .eq("session_id", id)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: baseline } = await supabase.from("baseline_snapshots").select("id").eq("session_id", id).maybeSingle();
  const { data: eligibility } = await supabase
    .from("eligibility_evaluations")
    .select("disposition")
    .eq("session_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const empiricalClaim = confirmation?.confirmed_empirical_claim ?? confirmation?.confirmed_wording ?? null;
  if (!empiricalClaim || !baseline || eligibility?.disposition !== "eligible") {
    return NextResponse.json({ error: "server_error", details: "revalidation failed: claim/baseline/eligibility not in the expected state" }, { status: 500 });
  }

  // Item 5: re-check pack scope — the topic's pack must still be enabled now.
  const pack = getEnabledPackForTopic(session.pack_topic ?? "");
  if (!pack) {
    return NextResponse.json({ error: "server_error", details: "no enabled evidence pack for this topic" }, { status: 500 });
  }
  const policy = getPackPolicy(pack.id);

  // Item 3: classify into the pack's closed kind list, or none/unclear —
  // never force-matched, never a human queue.
  let kind: string;
  if (!policy) {
    kind = "none";
  } else if (session.claim_kind_clarification_asked && parsed.data.clarificationAnswer) {
    const result = await classifyClaim({
      empiricalClaim,
      policy,
      clarification: { question: session.claim_kind_clarification_question ?? CLAIM_KIND_CLARIFICATION_QUESTION, answer: parsed.data.clarificationAnswer },
    });
    const validated = validateClassification(result.classification, policy);
    // One bounded clarification only — a second "unclear" is treated as
    // "none", never a second round.
    kind = validated === "unclear" ? "none" : validated;
  } else {
    const result = await classifyClaim({ empiricalClaim, policy });
    const validated = validateClassification(result.classification, policy);
    if (validated === "unclear" && !session.claim_kind_clarification_asked) {
      await supabase.from("sessions").update({ claim_kind_clarification_question: CLAIM_KIND_CLARIFICATION_QUESTION, claim_kind_clarification_asked: true }).eq("id", id);
      return NextResponse.json({ outcome: "needs_clarification", question: CLAIM_KIND_CLARIFICATION_QUESTION });
    }
    kind = validated === "unclear" ? "none" : validated;
  }

  const decision = decideAutoDeliveryOutcome(kind, policy);
  if (decision.outcome === "park") {
    const fromState = session.state as "assigned" | "pending_review" | "approved";
    const t = await transitionSession(supabase, id, fromState, session.revision, ["parked"], { park_reason: NO_SUITABLE_EVIDENCE_REASON });
    if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
    await recordAuditEvent({ actorType: "system", action: "auto_discovery_only", entityType: "sessions", entityId: id, after: { kind } });
    return NextResponse.json({ outcome: "parked", reason: NO_SUITABLE_EVIDENCE_REASON });
  }

  // Deliver: deterministic composition from verbatim pack claims only (item 1).
  const { data: assignment } = await supabase.from("assignments").select("id, condition, pack_id, pack_version").eq("session_id", id).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "server_error", details: "no assignment recorded" }, { status: 500 });

  const orderedClaims = selectClaims(pack, assignment.condition as "fixed" | "personalized", empiricalClaim);
  const content = composeDelivery(pack, orderedClaims, empiricalClaim);
  const claimOrder = orderedClaims.map((c) => c.id);
  const contentHash = computeContentHash(content.text, claimOrder, DELIVERY_TEMPLATE_VERSION);

  const { data: draft, error: draftError } = await supabase
    .from("draft_revisions")
    .insert({
      session_id: id,
      assignment_id: assignment.id,
      claim_order: claimOrder,
      rendered_text: content.text,
      rendered_html: content.html,
      word_count: content.wordCount,
      content_hash: contentHash,
      template_version: DELIVERY_TEMPLATE_VERSION,
    })
    .select("id")
    .single();
  if (draftError || !draft) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const sourceMap = claimOrder.map((claimId) => {
    const claim = pack.claims.find((c) => c.id === claimId);
    return { claimId, sourceTitle: claim?.sourceTitle ?? "unknown", url: claim?.url ?? "", locator: claim?.locator ?? "" };
  });

  const checkResults = {
    withdrawnAt: null,
    eligibilityDisposition: eligibility.disposition,
    baselineFrozen: true,
    packEnabled: true,
    classification: kind,
    policyVersion: PACK_POLICY_VERSION,
  };

  // Defensive pre-check against the same state machine every other route
  // uses — the RPC's own expected-state/revision check is the actual
  // atomic guarantee, this just fails fast and loudly on a logic error.
  assertTransition(session.state as "assigned" | "pending_review" | "approved", "delivered");

  const { data: rpcResult, error: rpcError } = await supabase.rpc("auto_deliver_session", {
    p_session_id: id,
    p_expected_state: session.state,
    p_expected_revision: session.revision,
    p_draft_revision_id: draft.id,
    p_claim_kind: kind,
    p_legacy_disposition: legacyDisposition(true, decision.evidenceRelation),
    p_evidence_relation: decision.evidenceRelation,
    p_policy_version: PACK_POLICY_VERSION,
    p_pack_version: pack.version,
    p_template_version: DELIVERY_TEMPLATE_VERSION,
    p_check_results: checkResults,
    p_exact_text: content.text,
    p_exact_html: content.html,
    p_claim_ids: claimOrder,
    p_source_map: sourceMap,
    p_boundary_text: pack.boundary,
    p_content_hash: contentHash,
  });
  if (rpcError || !rpcResult?.[0]) {
    if (rpcError?.message?.includes("was withdrawn")) {
      return NextResponse.json({ error: "invalid_state", details: "participant withdrew before delivery could be recorded" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error", details: rpcError?.message }, { status: 500 });
  }

  await recordAuditEvent({ actorType: "system", action: "auto_delivered", entityType: "sessions", entityId: id, after: { kind, evidenceRelation: decision.evidenceRelation, packVersion: pack.version } });

  return NextResponse.json({ outcome: "delivered" });
}
