import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { postMessageSchema } from "@/lib/zod/requests";
import { transitionSession } from "@/lib/session-transition";
import { mergeFields, firstMissingField, type FieldMap } from "@/lib/extraction-merge";
import { runDiscoveryTurn, type DiscoveryMessageForModel } from "@/lib/ai/discovery";
import { MIXED_DRIVER_QUESTION, MIXED_DRIVER_FOLLOWUP, RECOVERY_MESSAGE, hasCoreFields, isValidationFailure, mixedDriverNextQuestion } from "@/lib/ai/discovery-pure";
import { generateBeliefWording, generateDecisionNarrative, generateEmpiricalClaim } from "@/lib/belief-wording";
import { DISCOVERY_QUESTION_BUDGET } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { proposeTopicKey, topicConfirmationQuestion, interpretYesNo } from "@/lib/topic-proposal";
import { getEnabledPackForTopic } from "@/lib/evidence";

// Every substantive park must show a nonempty reason (null, "", and
// whitespace-only all count as missing). "candidate_ready" deliberately has
// no entry here — once "validation failure" is split out below (one bounded
// repair, then an explicit recovery state), a legitimate park can no longer
// reach this table carrying that stop_reason. Falling through to the
// no_stable_candidate message if it ever did is honest, not blank.
const STOP_REASON_MESSAGES: Record<string, string> = {
  question_budget_exhausted: "We weren't able to pin down a clear, checkable expectation in the time we had for this.",
  unsafe_or_excluded: "This topic falls outside what this study can safely discuss.",
  no_stable_candidate: "This sounds more like a preference, a practical constraint, or something that affected you socially rather than a specific expectation we can check.",
};

function nonEmpty(value: string | null | undefined): string | null {
  return value && value.trim().length > 0 ? value : null;
}

// Generous enough for a real interview (max 8 real questions) plus
// legitimate retries, tight enough to stop a runaway loop from repeatedly
// hitting the model.
const DISCOVERY_TURN_LIMIT = 30;
const DISCOVERY_TURN_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const turnStart = Date.now();
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rate = checkRateLimit(`discovery-turn:${id}`, DISCOVERY_TURN_LIMIT, DISCOVERY_TURN_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = postMessageSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  const { content, inputMode, clientToken } = parsed.data;

  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("state, revision, pack_topic, discovery_repair_used, discovery_recovery_reason")
    .eq("id", id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "context" && session.state !== "discovery") {
    return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });
  }
  const { data: existingMessages } = await supabase
    .from("messages")
    .select("id, turn_number, role, content, client_token")
    .eq("session_id", id)
    .order("turn_number", { ascending: true });
  const messages = existingMessages ?? [];

  // Idempotency: if this exact attempt already landed (e.g. the client
  // timed out waiting but the server actually finished the write), don't
  // insert a second participant turn or call the model again. If that
  // original turn is still mid-flight (no assistant reply yet and the
  // session hasn't moved on), tell the client to keep polling/reconnecting
  // instead of a one-shot "duplicate" that could strand it on a stale
  // "Getting started" screen forever.
  if (clientToken && messages.some((m) => m.client_token === clientToken)) {
    // In-flight iff the session hasn't moved on AND hasn't resolved into a
    // recovery state either — a recovery outcome leaves state at
    // 'discovery' with no new assistant row, but it IS a completed turn,
    // not a pending one.
    const stillInFlight = session.state === "discovery" && !session.discovery_recovery_reason && messages[messages.length - 1]?.role === "participant";
    return NextResponse.json({ assistantQuestion: null, done: false, duplicate: true, inFlight: stillInFlight });
  }

  if (content === null && messages.length > 0) {
    // The kickoff call (content===null) doesn't always create a
    // participant row to dedupe against (e.g. no free-text story was
    // typed), so a retried kickoff after the real first turn already
    // succeeded can't be matched by client_token. Treat it as a resync
    // request rather than an error — the client just needs the state it
    // already has, not a fresh turn.
    return NextResponse.json({ assistantQuestion: null, done: false, duplicate: true, inFlight: false });
  }

  let nextTurnNumber = messages.length > 0 ? messages[messages.length - 1].turn_number + 1 : 1;

  // On kickoff (content === null), a participant may have already typed a
  // full story under a situation card on /participate. Use that story as
  // the first real turn instead of silently discarding it and asking a
  // generic opening question the participant already answered.
  let effectiveContent = content;
  if (content === null && messages.length === 0) {
    const { data: contextRow } = await supabase.from("context_answers").select("free_text").eq("session_id", id).maybeSingle();
    if (contextRow?.free_text?.trim()) {
      effectiveContent = contextRow.free_text.trim();
    }
  }

  let participantMessage: { id: string; content: string } | null = null;
  if (effectiveContent !== null) {
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        session_id: id,
        turn_number: nextTurnNumber,
        role: "participant",
        input_mode: effectiveContent === content ? inputMode : "text",
        content: effectiveContent,
        client_token: clientToken ?? null,
      })
      .select("id, content")
      .single();
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    participantMessage = inserted;
    nextTurnNumber += 1;
  }

  const { data: extractionHistory } = await supabase
    .from("extraction_snapshots")
    .select("fields")
    .eq("session_id", id)
    .order("created_at", { ascending: true });
  const fieldsBefore = mergeFields((extractionHistory ?? []).map((r) => r.fields as FieldMap));
  const nextMissingFieldHint = firstMissingField(fieldsBefore);

  const { data: context } = await supabase.from("context_answers").select("situation_card, goal, decision_cue, free_text").eq("session_id", id).maybeSingle();

  const recentMessages: DiscoveryMessageForModel[] = [...messages, ...(participantMessage ? [{ id: participantMessage.id, role: "participant" as const, content: participantMessage.content }] : [])]
    .slice(-16)
    .map((m) => ({ id: m.id, role: m.role as "participant" | "assistant", content: m.content }));

  const questionsAskedSoFar = messages.filter((m) => m.role === "assistant").length;

  const phaseAfterPrep = Date.now();
  const result = await runDiscoveryTurn({
    situationCard: context?.situation_card ?? "other",
    goal: context?.goal ?? null,
    decisionCue: context?.decision_cue ?? null,
    recentMessages,
    currentFields: fieldsBefore,
    nextMissingFieldHint,
    questionsAskedSoFar,
    questionBudget: DISCOVERY_QUESTION_BUDGET,
  });
  const phaseAfterModel = Date.now();

  let turn = result.turn;

  // Tier 1 item 2: preference language ("I like/enjoy/prefer") does not by
  // itself settle whether an expectation drove the choice. When the model
  // flags that ambiguity, ask the fixed neutral clarifying question instead
  // of letting it stop/park — enforced server-side so it can't be skipped
  // by a paraphrase, and asked at most once (then its one allowed
  // follow-up), never re-asked once answered.
  const mixedQuestion = mixedDriverNextQuestion(
    turn.candidate_driver,
    recentMessages.some((m) => m.role === "assistant" && m.content === MIXED_DRIVER_QUESTION),
    recentMessages.some((m) => m.role === "assistant" && m.content === MIXED_DRIVER_FOLLOWUP),
  );
  if (mixedQuestion) {
    turn = { ...turn, should_stop: false, stop_reason: null, next_question: mixedQuestion };
  }

  console.log("[discovery-turn-latency]", {
    sessionId: id,
    totalMs: Date.now() - turnStart,
    prepMs: phaseAfterPrep - turnStart,
    modelMs: phaseAfterModel - phaseAfterPrep,
    reportedModelMs: result.latencyMs,
    postMs: Date.now() - phaseAfterModel,
    fallback: result.fallback,
  });

  await supabase.from("extraction_snapshots").insert({
    session_id: id,
    message_id: participantMessage?.id ?? null,
    fields: turn.extraction,
    field_evidence: turn.field_evidence,
    candidate_driver: turn.candidate_driver,
    should_stop: turn.should_stop,
    stop_reason: turn.stop_reason,
    safety: turn.safety,
    prompt_version: result.promptVersion,
    model: result.model,
    request_id: result.requestId,
    latency_ms: result.latencyMs,
    fallback: result.fallback,
    error: result.errorMessage ? { message: result.errorMessage } : null,
    validation_diagnostics: result.validationDiagnostics,
  });

  const fieldsAfter = mergeFields([...(extractionHistory ?? []).map((r) => r.fields as FieldMap), turn.extraction]);
  const hasCore = hasCoreFields(fieldsAfter);
  const unsafe = turn.stop_reason === "unsafe_or_excluded" || turn.safety === "stop";
  const validationFailure = isValidationFailure(turn, hasCore);

  if (!validationFailure && (session.discovery_repair_used || session.discovery_recovery_reason)) {
    // Real progress happened — clear any stale repair/recovery markers from
    // an earlier, different gap so the next genuine gap gets its own
    // one-shot repair.
    await supabase.from("sessions").update({ discovery_repair_used: false, discovery_recovery_reason: null }).eq("id", id);
  }

  if (validationFailure) {
    if (!session.discovery_repair_used) {
      // One bounded repair: ask a neutral, specific missing-field question
      // using the template already reserved for this (never invents a
      // field or a citation). Stays in 'discovery'; costs one real question
      // against the existing budget, same as any other turn.
      await supabase.from("sessions").update({ discovery_repair_used: true }).eq("id", id);
      const missingCore = (["chosen_action", "rejected_alternative", "expected_outcome"] as const).find((f) => !fieldsAfter[f]) ?? "chosen_action";
      const repairQuestion =
        missingCore === "chosen_action"
          ? "What did you actually decide to do?"
          : missingCore === "rejected_alternative"
            ? "What was the other option you did not choose?"
            : "What did you expect would happen with the option you chose?";
      const { error } = await supabase.from("messages").insert({ session_id: id, turn_number: nextTurnNumber, role: "assistant", input_mode: "text", content: repairQuestion });
      if (session.state === "context") {
        await transitionSession(supabase, id, "context", session.revision, ["discovery"]);
      }
      return NextResponse.json({ assistantQuestion: error ? null : repairQuestion, done: false, safety: turn.safety, repaired: true });
    }

    // The one bounded repair also failed to produce a validated core. This
    // is an explicit, distinct recovery state — never a blank or
    // preference-labelled park. Session stays in 'discovery'; no assistant
    // message is inserted (there is nothing honest left to ask
    // automatically), and the recovery reason is persisted so it survives a
    // refresh and is visible to researchers without being conflated with a
    // substantive park anywhere (state, researcher view, receipts, exports).
    const currentRevision = session.state === "context" ? session.revision + 1 : session.revision;
    if (session.state === "context") {
      await transitionSession(supabase, id, "context", session.revision, ["discovery"]);
    }
    await supabase.from("sessions").update({ discovery_recovery_reason: RECOVERY_MESSAGE, revision: currentRevision }).eq("id", id);
    await recordAuditEvent({ actorType: "system", action: "discovery_recovery", entityType: "sessions", entityId: id, after: { stopReason: turn.stop_reason } });
    return NextResponse.json({ assistantQuestion: null, done: false, recovery: true, reason: RECOVERY_MESSAGE });
  }

  let assistantMessage: string | null = null;
  if (!turn.should_stop && turn.next_question) {
    const { error } = await supabase
      .from("messages")
      .insert({ session_id: id, turn_number: nextTurnNumber, role: "assistant", input_mode: "text", content: turn.next_question });
    if (!error) assistantMessage = turn.next_question;
  }

  // Transition session state if this is the first turn.
  if (session.state === "context") {
    await transitionSession(supabase, id, "context", session.revision, ["discovery"]);
  }
  const currentRevision = session.state === "context" ? session.revision + 1 : session.revision;

  if (!turn.should_stop) {
    return NextResponse.json({ assistantQuestion: assistantMessage, done: false, safety: turn.safety });
  }

  // should_stop === true: either move to confirmation, or park honestly.
  if (turn.stop_reason === "candidate_ready" && hasCore && !unsafe) {
    // Tier 2 item 9: a free-text-only story (no situation card) leaves
    // pack_topic null forever, which fails the checkable gate regardless
    // of actual content. Propose a catalog topic from the participant's
    // own words and ask ONE neutral yes/no question before confirmation —
    // never force-matched; a decline or anything ambiguous leaves
    // pack_topic null and proceeds exactly as before.
    if (!session.pack_topic) {
      const participantText = recentMessages
        .filter((m) => m.role === "participant")
        .map((m) => m.content)
        .join(" ");
      const proposed = proposeTopicKey(participantText);
      if (proposed) {
        const question = topicConfirmationQuestion(proposed);
        const alreadyAsked = recentMessages.some((m) => m.role === "assistant" && m.content === question);
        if (!alreadyAsked) {
          const { error } = await supabase.from("messages").insert({ session_id: id, turn_number: nextTurnNumber, role: "assistant", input_mode: "text", content: question });
          return NextResponse.json({ assistantQuestion: error ? null : question, done: false, safety: turn.safety });
        }
        if (interpretYesNo(participantMessage?.content ?? "") && getEnabledPackForTopic(proposed)) {
          await supabase.from("sessions").update({ pack_topic: proposed }).eq("id", id);
          await recordAuditEvent({ actorType: "system", action: "topic_proposed_and_confirmed", entityType: "sessions", entityId: id, after: { proposedTopic: proposed } });
        }
        // Decline/ambiguous: pack_topic stays null; falls through to the
        // existing confirmation path exactly as before.
      }
    }

    const generatedWording = generateBeliefWording(fieldsAfter);
    await supabase.from("belief_confirmations").insert({
      session_id: id,
      revision: 1,
      generated_wording: generatedWording,
      generated_decision_narrative: generateDecisionNarrative(fieldsAfter),
      generated_empirical_claim: generateEmpiricalClaim(fieldsAfter),
    });
    const t = await transitionSession(supabase, id, "discovery", currentRevision, ["confirmation"]);
    if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
    await recordAuditEvent({ actorType: "system", action: "discovery_ready_for_confirmation", entityType: "sessions", entityId: id, after: fieldsAfter });
    return NextResponse.json({ assistantQuestion: null, done: true, nextStep: "confirmation", generatedWording });
  }

  const reason =
    nonEmpty(unsafe ? STOP_REASON_MESSAGES.unsafe_or_excluded : STOP_REASON_MESSAGES[turn.stop_reason ?? "no_stable_candidate"]) ?? STOP_REASON_MESSAGES.no_stable_candidate;

  const t = await transitionSession(supabase, id, "discovery", currentRevision, ["parked"], { park_reason: reason });
  if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
  await recordAuditEvent({ actorType: "system", action: "parked_from_discovery", entityType: "sessions", entityId: id, after: { reason, stopReason: turn.stop_reason } });
  return NextResponse.json({ assistantQuestion: null, done: true, nextStep: "parked", reason });
}
