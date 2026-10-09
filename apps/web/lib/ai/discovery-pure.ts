/**
 * Pure helpers factored out of discovery.ts so they're unit-testable
 * without pulling in "server-only"/the OpenAI client. No network, no env.
 */
import { FIELD_NAMES, type DiscoveryTurn, type FieldName } from "../zod/discovery";

/** One UUID anywhere in a citation string counts as that ID, even if the
 * model wrapped it in extra text (e.g. `"<id>: \"quoted snippet\""`). We
 * still require a REAL valid participant message ID to be present — this
 * only tolerates formatting, it never accepts a citation with no valid ID
 * in it. Confirmed via a live-model repro (2026-10-09): the model reliably
 * cites `id: "quote"` rather than a bare id, and a strict equality check
 * was nulling honestly-cited fields. */
const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

function resolveCitation(raw: string, validIds: Set<string>): string | null {
  if (validIds.has(raw)) return raw;
  const match = raw.match(UUID_RE);
  if (match && validIds.has(match[0])) return match[0];
  return null;
}

/** Structural-only diagnostics — field names, booleans, counts. Never raw
 * transcript text, so this is safe to persist for researcher-only viewing. */
export interface FieldValidationDiagnostic {
  field: FieldName;
  hadValue: boolean;
  citationCount: number;
  resolvedCitationCount: number;
  rejected: boolean;
}

export interface ProvenanceResult {
  turn: DiscoveryTurn;
  diagnostics: FieldValidationDiagnostic[];
}

/** Strips any field whose cited message IDs don't resolve to a real
 * participant message in this turn's input, and reports per-field why. */
export function enforceProvenance(turn: DiscoveryTurn, validParticipantMessageIds: Set<string>): ProvenanceResult {
  const extraction = { ...turn.extraction };
  const fieldEvidence = { ...turn.field_evidence };
  const diagnostics: FieldValidationDiagnostic[] = [];

  for (const field of FIELD_NAMES) {
    const rawCitations = fieldEvidence[field] ?? [];
    const resolved = rawCitations.map((c) => resolveCitation(c, validParticipantMessageIds)).filter((id): id is string => id !== null);
    const hadValue = extraction[field] !== null;
    const allValid = resolved.length > 0 && resolved.length === rawCitations.length;
    const rejected = hadValue && !allValid;

    if (rejected) {
      extraction[field] = null;
      fieldEvidence[field] = [];
    } else if (hadValue) {
      // Normalize to bare IDs so downstream storage/exports are clean.
      fieldEvidence[field] = resolved;
    }

    diagnostics.push({
      field,
      hadValue,
      citationCount: rawCitations.length,
      resolvedCitationCount: resolved.length,
      rejected,
    });
  }

  return { turn: { ...turn, extraction, field_evidence: fieldEvidence }, diagnostics };
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

/** Tier 1 item 2: one neutral question when preference language and an
 * outcome-belief claim coexist and the driver is genuinely unclear. Exact
 * wording per spec — never paraphrased, never suggests which answer is
 * "correct". */
export const MIXED_DRIVER_QUESTION = "What mattered most in that choice: what you expected would happen, what you enjoyed, a constraint, or a combination?";
export const MIXED_DRIVER_FOLLOWUP = "If you expected both options to give the same result, would you make the same choice?";

/** The one explicit recovery message required by spec — distinct from any
 * substantive park reason, shown only after one bounded repair also fails. */
export const RECOVERY_MESSAGE = "We couldn't reliably record your expectation from that answer. Your answer is saved. You can try again or ask for researcher review.";

/** The three fields a read-back template needs. Shared source of truth
 * between the route and its tests, so "what counts as core" never drifts
 * between the two. */
export function hasCoreFields(fields: Record<string, string | null>): boolean {
  return Boolean(fields.chosen_action && fields.rejected_alternative && fields.expected_outcome);
}

/**
 * The validation-failure signature: the model is confident enough to stop
 * ("candidate_ready") but, after provenance enforcement, the core fields a
 * confirmation needs aren't actually there. That's a technical extraction
 * failure — never evidence of a preference — so it must be routed to a
 * bounded repair / recovery, never silently confirmed or parked.
 */
export function isValidationFailure(turn: Pick<DiscoveryTurn, "should_stop" | "stop_reason" | "safety">, hasCore: boolean): boolean {
  const unsafe = turn.stop_reason === "unsafe_or_excluded" || turn.safety === "stop";
  return Boolean(turn.should_stop) && turn.stop_reason === "candidate_ready" && !hasCore && !unsafe;
}
