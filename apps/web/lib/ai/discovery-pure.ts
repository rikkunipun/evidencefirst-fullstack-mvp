/**
 * Pure helpers factored out of discovery.ts so they're unit-testable
 * without pulling in "server-only"/the OpenAI client. No network, no env.
 */
import { FIELD_NAMES, type DiscoveryTurn, type FieldName } from "../zod/discovery";

/** Strips any field whose cited message IDs aren't real participant messages in this turn's input. */
export function enforceProvenance(turn: DiscoveryTurn, validParticipantMessageIds: Set<string>): DiscoveryTurn {
  const extraction = { ...turn.extraction };
  const fieldEvidence = { ...turn.field_evidence };
  for (const field of FIELD_NAMES) {
    const citations = fieldEvidence[field] ?? [];
    const allValid = citations.length > 0 && citations.every((id) => validParticipantMessageIds.has(id));
    if (extraction[field] !== null && !allValid) {
      extraction[field] = null;
      fieldEvidence[field] = [];
    }
  }
  return { ...turn, extraction, field_evidence: fieldEvidence };
}

const FALLBACK_TEMPLATES: Record<FieldName, string> = {
  chosen_action: "What did you actually decide to do?",
  rejected_alternative: "What was the other option you did not choose?",
  expected_outcome: "What did you expect would happen with the option you chose?",
  origin_of_expectation: "What made you expect that — something you read, heard, or experienced?",
  actual_consequence: "Has anything actually happened yet as a result of that choice?",
  consequence_evidence: "What tells you that happened — a bill, a result, or something you noticed?",
};

/** Logged, explicitly-labelled fallback turn — never presented as a successful model response. */
export function neutralFallbackTurn(nextMissingFieldHint: FieldName | null, budgetExhausted: boolean): DiscoveryTurn {
  return {
    next_question: budgetExhausted ? null : nextMissingFieldHint ? FALLBACK_TEMPLATES[nextMissingFieldHint] : "Can you tell me a bit more about what happened?",
    extraction: {
      chosen_action: null,
      rejected_alternative: null,
      expected_outcome: null,
      origin_of_expectation: null,
      actual_consequence: null,
      consequence_evidence: null,
    },
    field_evidence: {
      chosen_action: [],
      rejected_alternative: [],
      expected_outcome: [],
      origin_of_expectation: [],
      actual_consequence: [],
      consequence_evidence: [],
    },
    next_missing_field: nextMissingFieldHint,
    candidate_driver: "unclear",
    needs_participant_confirmation: false,
    should_stop: budgetExhausted,
    stop_reason: budgetExhausted ? "question_budget_exhausted" : null,
    safety: "in_scope",
  };
}
