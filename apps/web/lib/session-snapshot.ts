import "server-only";
import { getServiceClient } from "./supabase/service-client";
import type { SessionSnapshot, ParticipantSessionSnapshot } from "./types/session";
import type { SessionState } from "./state-machine";
import { getEnv } from "./env";

export type { SessionSnapshot, ParticipantSessionSnapshot };

/**
 * The only shape a participant's own routes/pages may return. Strips
 * condition/assignment, draft text, reviewer disposition, and raw model
 * extraction reasoning — none of that is this participant's business,
 * before or after delivery. Admin routes must keep using the full
 * `loadSessionSnapshot` result directly; never pass it through here.
 */
export function toParticipantSnapshot(full: SessionSnapshot): ParticipantSessionSnapshot {
  // Explicit allowlist, not a denylist spread — a future field added to
  // SessionSnapshot is safe-by-default (excluded here) until someone
  // deliberately adds it below, rather than silently leaking through.
  return {
    session: full.session,
    context: full.context,
    messages: full.messages,
    questionsAsked: full.questionsAsked,
    beliefConfirmation: full.beliefConfirmation,
    eligibility: full.eligibility,
    baseline: full.baseline,
    cruxPasses: full.cruxPasses,
    cruxClassification: full.cruxClassification,
    measurements: full.measurements,
    delivery: full.delivery,
    followup: full.followup,
    deliveryMode: full.deliveryMode,
  };
}

/**
 * Everything needed to render the participant's current step, or to drive
 * server-side validation before a mutation. One shared builder so the UI
 * and every route agree on exactly what the database says.
 */

export async function loadSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
  const supabase = getServiceClient();

  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, state, revision, pack_topic, created_at, withdrawn_at, park_reason, discovery_recovery_reason, pilot_label, claim_kind_clarification_question, researcher_flagged, researcher_flag_note",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;

  const [{ data: context }, { data: messages }, { data: extractions }, { data: confirmations }, { data: eligibilities }, { data: baseline }, { data: cruxPassesRaw }, { data: cruxClassRaw }, { data: measurements }, { data: assignment }, { data: draft }, { data: delivery }, { data: followup }] =
    await Promise.all([
      supabase.from("context_answers").select("situation_card, goal, decision_cue, free_text").eq("session_id", sessionId).maybeSingle(),
      supabase.from("messages").select("id, turn_number, role, content, created_at").eq("session_id", sessionId).order("turn_number", { ascending: true }),
      supabase
        .from("extraction_snapshots")
        .select("fields, candidate_driver, should_stop, stop_reason, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("belief_confirmations")
        .select(
          "id, revision, generated_wording, confirmed_wording, confirmed_at, generated_decision_narrative, generated_empirical_claim, confirmed_decision_narrative, confirmed_empirical_claim",
        )
        .eq("session_id", sessionId)
        .order("revision", { ascending: false }),
      supabase.from("eligibility_evaluations").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1),
      supabase.from("baseline_snapshots").select("belief_wording, scope_and_time, baseline_score, frozen_at").eq("session_id", sessionId).maybeSingle(),
      supabase.from("crux_passes").select("id, pass_number, stated_reason, confirmed_reason, hypothetical_score").eq("session_id", sessionId).order("pass_number", { ascending: true }),
      supabase.from("crux_classifications").select("classification, crux_pass_id, created_at").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1),
      supabase.from("measurements").select("phase, score, explanation, recorded_at").eq("session_id", sessionId),
      supabase.from("assignments").select("condition, pack_id, pack_version").eq("session_id", sessionId).maybeSingle(),
      supabase.from("draft_revisions").select("id, claim_order, rendered_text, word_count, content_hash").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1),
      supabase.from("deliveries").select("exact_text, exact_html, claim_ids, source_map, delivered_at, displayed_ack_at").eq("session_id", sessionId).maybeSingle(),
      supabase.from("followups").select("due_at, collected_at").eq("session_id", sessionId).maybeSingle(),
    ]);

  const latestConfirmation = confirmations?.[0] ?? null;
  const latestDraftId = draft?.[0]?.id ?? null;
  const { data: approval } = latestDraftId
    ? await supabase
        .from("approvals")
        .select("disposition, approved_at, is_system, evidence_relation, policy_version, pack_version, check_results")
        .eq("draft_revision_id", latestDraftId)
        .order("approved_at", { ascending: false })
        .limit(1)
    : { data: [] as { disposition: string; approved_at: string; is_system: boolean; evidence_relation: string | null; policy_version: string | null; pack_version: string | null; check_results: Record<string, unknown> | null }[] };

  return {
    session: {
      id: session.id,
      state: session.state as SessionState,
      revision: session.revision,
      packTopic: session.pack_topic,
      createdAt: session.created_at,
      withdrawnAt: session.withdrawn_at,
      parkReason: session.park_reason,
      discoveryRecoveryReason: session.discovery_recovery_reason,
      pilotLabel: session.pilot_label,
      claimKindClarificationQuestion: session.claim_kind_clarification_question,
      researcherFlagged: session.researcher_flagged,
      researcherFlagNote: session.researcher_flag_note,
    },
    deliveryMode: getEnv().DELIVERY_MODE,
    context: context
      ? { situationCard: context.situation_card, goal: context.goal, decisionCue: context.decision_cue, freeText: context.free_text }
      : null,
    messages: (messages ?? []).map((m) => ({ id: m.id, turnNumber: m.turn_number, role: m.role, content: m.content, createdAt: m.created_at })),
    latestExtraction: extractions?.[0]
      ? {
          fields: extractions[0].fields,
          candidateDriver: extractions[0].candidate_driver,
          shouldStop: extractions[0].should_stop,
          stopReason: extractions[0].stop_reason,
        }
      : null,
    questionsAsked: (messages ?? []).filter((m) => m.role === "assistant").length,
    beliefConfirmation: latestConfirmation
      ? {
          id: latestConfirmation.id,
          revision: latestConfirmation.revision,
          generatedWording: latestConfirmation.generated_wording,
          confirmedWording: latestConfirmation.confirmed_wording,
          confirmedAt: latestConfirmation.confirmed_at,
          generatedDecisionNarrative: latestConfirmation.generated_decision_narrative,
          generatedEmpiricalClaim: latestConfirmation.generated_empirical_claim,
          confirmedDecisionNarrative: latestConfirmation.confirmed_decision_narrative,
          confirmedEmpiricalClaim: latestConfirmation.confirmed_empirical_claim,
        }
      : null,
    eligibility: eligibilities?.[0]
      ? {
          current: eligibilities[0].current_status,
          specific: eligibilities[0].specific_status,
          causal: eligibilities[0].causal_status,
          consequential: eligibilities[0].consequential_status,
          checkable: eligibilities[0].checkable_status,
          safe: eligibilities[0].safe_status,
          disposition: eligibilities[0].disposition,
          reasons: eligibilities[0].reasons,
        }
      : null,
    baseline: baseline
      ? { beliefWording: baseline.belief_wording, scopeAndTime: baseline.scope_and_time, baselineScore: baseline.baseline_score, frozenAt: baseline.frozen_at }
      : null,
    cruxPasses: (cruxPassesRaw ?? []).map((c) => ({
      passNumber: c.pass_number,
      statedReason: c.stated_reason,
      confirmedReason: c.confirmed_reason,
      hypotheticalScore: c.hypothetical_score,
    })),
    cruxClassification: cruxClassRaw?.[0]?.classification ?? null,
    measurements: (measurements ?? []).map((m) => ({ phase: m.phase, score: m.score, explanation: m.explanation, recordedAt: m.recorded_at })),
    assignment: assignment ? { condition: assignment.condition, packId: assignment.pack_id, packVersion: assignment.pack_version } : null,
    draft: draft?.[0] ? { id: draft[0].id, claimOrder: draft[0].claim_order, renderedText: draft[0].rendered_text, wordCount: draft[0].word_count, contentHash: draft[0].content_hash } : null,
    approval: approval?.[0]
      ? {
          disposition: approval[0].disposition,
          approvedAt: approval[0].approved_at,
          isSystem: approval[0].is_system,
          evidenceRelation: approval[0].evidence_relation,
          policyVersion: approval[0].policy_version,
          packVersion: approval[0].pack_version,
          checkResults: approval[0].check_results,
        }
      : null,
    delivery: delivery
      ? {
          exactText: delivery.exact_text,
          exactHtml: delivery.exact_html,
          claimIds: delivery.claim_ids,
          sourceMap: delivery.source_map,
          deliveredAt: delivery.delivered_at,
          displayedAckAt: delivery.displayed_ack_at,
        }
      : null,
    followup: followup ? { dueAt: followup.due_at, collectedAt: followup.collected_at } : null,
  };
}
