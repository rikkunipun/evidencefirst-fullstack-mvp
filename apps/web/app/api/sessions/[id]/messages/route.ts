import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { postMessageSchema } from "@/lib/zod/requests";
import { transitionSession } from "@/lib/session-transition";
import { mergeFields, firstMissingField, type FieldMap } from "@/lib/extraction-merge";
import { runDiscoveryTurn, type DiscoveryMessageForModel } from "@/lib/ai/discovery";
import { generateBeliefWording } from "@/lib/belief-wording";
import { DISCOVERY_QUESTION_BUDGET } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/audit";

const STOP_REASON_MESSAGES: Record<string, string> = {
  question_budget_exhausted: "We weren't able to pin down a clear, checkable expectation in the time we had for this.",
  unsafe_or_excluded: "This topic falls outside what this study can safely discuss.",
  no_stable_candidate: "This sounds more like a preference, a practical constraint, or something that affected you socially rather than a specific expectation we can check.",
  candidate_ready: "",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = postMessageSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  const { content, inputMode } = parsed.data;

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision, pack_topic").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "context" && session.state !== "discovery") {
    return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });
  }
  if (content === null) {
    const { data: existing } = await supabase.from("messages").select("id").eq("session_id", id).limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "invalid_request", details: "content required after the first turn" }, { status: 400 });
    }
  }

  const { data: existingMessages } = await supabase
    .from("messages")
    .select("id, turn_number, role, content")
    .eq("session_id", id)
    .order("turn_number", { ascending: true });
  const messages = existingMessages ?? [];
  let nextTurnNumber = messages.length > 0 ? messages[messages.length - 1].turn_number + 1 : 1;

  let participantMessage: { id: string; content: string } | null = null;
  if (content !== null) {
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({ session_id: id, turn_number: nextTurnNumber, role: "participant", input_mode: inputMode, content })
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

  const turn = result.turn;

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
  });

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
  const fieldsAfter = mergeFields([...(extractionHistory ?? []).map((r) => r.fields as FieldMap), turn.extraction]);
  const hasCore = Boolean(fieldsAfter.chosen_action && fieldsAfter.rejected_alternative && fieldsAfter.expected_outcome);
  const unsafe = turn.stop_reason === "unsafe_or_excluded" || turn.safety === "stop";

  if (turn.stop_reason === "candidate_ready" && hasCore && !unsafe) {
    const generatedWording = generateBeliefWording(fieldsAfter);
    await supabase.from("belief_confirmations").insert({ session_id: id, revision: 1, generated_wording: generatedWording });
    const t = await transitionSession(supabase, id, "discovery", currentRevision, ["confirmation"]);
    if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
    await recordAuditEvent({ actorType: "system", action: "discovery_ready_for_confirmation", entityType: "sessions", entityId: id, after: fieldsAfter });
    return NextResponse.json({ assistantQuestion: null, done: true, nextStep: "confirmation", generatedWording });
  }

  const reason = unsafe
    ? STOP_REASON_MESSAGES.unsafe_or_excluded
    : STOP_REASON_MESSAGES[turn.stop_reason ?? "no_stable_candidate"] ?? STOP_REASON_MESSAGES.no_stable_candidate;

  const t = await transitionSession(supabase, id, "discovery", currentRevision, ["parked"], { park_reason: reason });
  if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
  await recordAuditEvent({ actorType: "system", action: "parked_from_discovery", entityType: "sessions", entityId: id, after: { reason, stopReason: turn.stop_reason } });
  return NextResponse.json({ assistantQuestion: null, done: true, nextStep: "parked", reason });
}
