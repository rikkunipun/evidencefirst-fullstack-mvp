import { describe, expect, it } from "vitest";
import {
  enforceProvenance,
  neutralFallbackTurn,
  hasCoreFields,
  isValidationFailure,
  mixedDriverNextQuestion,
  MIXED_DRIVER_QUESTION,
  MIXED_DRIVER_FOLLOWUP,
} from "../../lib/ai/discovery-pure";
import type { DiscoveryTurn } from "../../lib/zod/discovery";

const EMPTY_EXTRACTION = {
  chosen_action: null,
  rejected_alternative: null,
  expected_outcome: null,
  origin_of_expectation: null,
  actual_consequence: null,
  consequence_evidence: null,
};
const EMPTY_EVIDENCE = {
  chosen_action: [] as string[],
  rejected_alternative: [] as string[],
  expected_outcome: [] as string[],
  origin_of_expectation: [] as string[],
  actual_consequence: [] as string[],
  consequence_evidence: [] as string[],
};

function baseTurn(overrides: Partial<DiscoveryTurn> = {}): DiscoveryTurn {
  return {
    next_question: "What happened?",
    extraction: { ...EMPTY_EXTRACTION },
    field_evidence: { ...EMPTY_EVIDENCE },
    next_missing_field: "chosen_action",
    candidate_driver: "unclear",
    needs_participant_confirmation: false,
    should_stop: false,
    stop_reason: null,
    safety: "in_scope",
    ...overrides,
  };
}

describe("enforceProvenance", () => {
  it("keeps a field whose citation is a real participant message in this turn's input", () => {
    const turn = baseTurn({
      extraction: { ...EMPTY_EXTRACTION, chosen_action: "skipping the gym" },
      field_evidence: { ...EMPTY_EVIDENCE, chosen_action: ["msg-1"] },
    });
    const { turn: result } = enforceProvenance(turn, new Set(["msg-1", "msg-2"]));
    expect(result.extraction.chosen_action).toBe("skipping the gym");
  });

  it("nulls a field with zero citations even if the extracted value looks plausible", () => {
    const turn = baseTurn({ extraction: { ...EMPTY_EXTRACTION, chosen_action: "invented answer" }, field_evidence: { ...EMPTY_EVIDENCE } });
    const { turn: result } = enforceProvenance(turn, new Set(["msg-1"]));
    expect(result.extraction.chosen_action).toBeNull();
  });

  it("nulls a field that cites a message ID not present in this turn's input (fabricated provenance)", () => {
    const turn = baseTurn({
      extraction: { ...EMPTY_EXTRACTION, chosen_action: "skipping the gym" },
      field_evidence: { ...EMPTY_EVIDENCE, chosen_action: ["msg-does-not-exist"] },
    });
    const { turn: result } = enforceProvenance(turn, new Set(["msg-1", "msg-2"]));
    expect(result.extraction.chosen_action).toBeNull();
    expect(result.field_evidence.chosen_action).toEqual([]);
  });

  it("nulls a field if even one of several citations is invalid (all-or-nothing)", () => {
    const turn = baseTurn({
      extraction: { ...EMPTY_EXTRACTION, actual_consequence: "lost strength" },
      field_evidence: { ...EMPTY_EVIDENCE, actual_consequence: ["msg-1", "msg-fabricated"] },
    });
    const { turn: result } = enforceProvenance(turn, new Set(["msg-1"]));
    expect(result.extraction.actual_consequence).toBeNull();
  });

  it("leaves an already-null field alone regardless of its (empty) evidence array", () => {
    const turn = baseTurn();
    const { turn: result } = enforceProvenance(turn, new Set(["msg-1"]));
    expect(result.extraction).toEqual(EMPTY_EXTRACTION);
  });

  // Regression for the 2026-10-09 confirmed root cause: the model reliably
  // cites `"<id>: \"<quoted snippet>\""` rather than a bare ID. A real,
  // valid ID embedded in that string must still count — this is a format
  // tolerance, not a provenance bypass: a citation with NO valid ID in it
  // (or a different session's ID) must still be rejected.
  it("resolves a citation that wraps a real, valid message ID in descriptive text", () => {
    const id = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const turn = baseTurn({
      extraction: { ...EMPTY_EXTRACTION, chosen_action: "taking the bus" },
      field_evidence: { ...EMPTY_EVIDENCE, chosen_action: [`${id}: "Last Monday I chose the bus"`] },
    });
    const { turn: result, diagnostics } = enforceProvenance(turn, new Set([id]));
    expect(result.extraction.chosen_action).toBe("taking the bus");
    expect(result.field_evidence.chosen_action).toEqual([id]);
    expect(diagnostics.find((d) => d.field === "chosen_action")?.rejected).toBe(false);
  });

  it("still rejects a wrapped citation whose embedded ID is not in the valid set", () => {
    const realId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const fabricatedId = "00000000-0000-4000-8000-000000000000";
    const turn = baseTurn({
      extraction: { ...EMPTY_EXTRACTION, chosen_action: "taking the bus" },
      field_evidence: { ...EMPTY_EVIDENCE, chosen_action: [`${fabricatedId}: "Last Monday I chose the bus"`] },
    });
    const { turn: result, diagnostics } = enforceProvenance(turn, new Set([realId]));
    expect(result.extraction.chosen_action).toBeNull();
    expect(diagnostics.find((d) => d.field === "chosen_action")?.rejected).toBe(true);
  });

  it("reports structural per-field diagnostics with counts and no transcript text", () => {
    const turn = baseTurn({
      extraction: { ...EMPTY_EXTRACTION, chosen_action: "skipping the gym", rejected_alternative: "invented" },
      field_evidence: { ...EMPTY_EVIDENCE, chosen_action: ["msg-1"], rejected_alternative: ["msg-fabricated"] },
    });
    const { diagnostics } = enforceProvenance(turn, new Set(["msg-1"]));
    const chosen = diagnostics.find((d) => d.field === "chosen_action");
    const rejected = diagnostics.find((d) => d.field === "rejected_alternative");
    expect(chosen).toMatchObject({ hadValue: true, citationCount: 1, resolvedCitationCount: 1, rejected: false });
    expect(rejected).toMatchObject({ hadValue: true, citationCount: 1, resolvedCitationCount: 0, rejected: true });
    expect(JSON.stringify(diagnostics)).not.toContain("invented");
  });
});

describe("required regression: candidate_ready + provenance-nulled core field never silently parks", () => {
  it("routes to repair/recovery, not confirm or park, when the model says ready but citations don't resolve", () => {
    // Shaped exactly like the live-model repro on the reviewer's failing
    // case: should_stop=true, stop_reason="candidate_ready", but every
    // citation is fabricated (does not resolve to a real participant
    // message), so provenance correctly nulls the core fields.
    const rawTurn = baseTurn({
      should_stop: true,
      stop_reason: "candidate_ready",
      extraction: { ...EMPTY_EXTRACTION, chosen_action: "taking the bus", rejected_alternative: "walking", expected_outcome: "would not count as exercise" },
      field_evidence: {
        ...EMPTY_EVIDENCE,
        chosen_action: ["msg-fabricated"],
        rejected_alternative: ["msg-fabricated"],
        expected_outcome: ["msg-fabricated"],
      },
    });
    const { turn: safeTurn } = enforceProvenance(rawTurn, new Set(["msg-1"]));
    const hasCore = hasCoreFields(safeTurn.extraction);
    expect(hasCore).toBe(false); // confirms the nulling actually happened
    expect(isValidationFailure(safeTurn, hasCore)).toBe(true); // must NOT fall through to a blank park
  });

  it("does not flag a validation failure for a genuine, well-cited preference stop", () => {
    const id = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const turn = baseTurn({
      should_stop: true,
      stop_reason: "no_stable_candidate",
      candidate_driver: "preference_value",
      extraction: { ...EMPTY_EXTRACTION, chosen_action: "diagrams" },
      field_evidence: { ...EMPTY_EVIDENCE, chosen_action: [id] },
    });
    const { turn: safeTurn } = enforceProvenance(turn, new Set([id]));
    expect(isValidationFailure(safeTurn, hasCoreFields(safeTurn.extraction))).toBe(false);
  });

  it("does not flag a validation failure once citations resolve and core fields are genuinely present", () => {
    const id = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const turn = baseTurn({
      should_stop: true,
      stop_reason: "candidate_ready",
      extraction: { ...EMPTY_EXTRACTION, chosen_action: "bus", rejected_alternative: "walking", expected_outcome: "would not count" },
      field_evidence: { ...EMPTY_EVIDENCE, chosen_action: [id], rejected_alternative: [id], expected_outcome: [id] },
    });
    const { turn: safeTurn } = enforceProvenance(turn, new Set([id]));
    expect(isValidationFailure(safeTurn, hasCoreFields(safeTurn.extraction))).toBe(false);
  });
});

describe("mixedDriverNextQuestion (Tier 1 item 2)", () => {
  it("asks the exact primary question when the driver is mixed/uncertain and nothing has been asked yet", () => {
    expect(mixedDriverNextQuestion("mixed_uncertain", false, false)).toBe(MIXED_DRIVER_QUESTION);
  });

  it("asks the exact follow-up once the primary question has already been asked", () => {
    expect(mixedDriverNextQuestion("mixed_uncertain", true, false)).toBe(MIXED_DRIVER_FOLLOWUP);
  });

  it("never re-asks once the follow-up has already been asked (resolved by the participant's next answer)", () => {
    expect(mixedDriverNextQuestion("mixed_uncertain", true, true)).toBeNull();
  });

  it("does not trigger for any other driver, including plain preference", () => {
    expect(mixedDriverNextQuestion("preference_value", false, false)).toBeNull();
    expect(mixedDriverNextQuestion("outcome_belief", false, false)).toBeNull();
    expect(mixedDriverNextQuestion("unclear", false, false)).toBeNull();
  });
});

describe("neutralFallbackTurn", () => {
  it("asks the matching template question for the next missing field", () => {
    const turn = neutralFallbackTurn("expected_outcome", false);
    expect(turn.next_question).toContain("expect");
    expect(turn.should_stop).toBe(false);
    expect(turn.stop_reason).toBeNull();
  });

  it("stops with question_budget_exhausted and a null question when the budget is spent", () => {
    const turn = neutralFallbackTurn("chosen_action", true);
    expect(turn.next_question).toBeNull();
    expect(turn.should_stop).toBe(true);
    expect(turn.stop_reason).toBe("question_budget_exhausted");
  });

  it("never fabricates an extraction or citation — every field stays null/empty", () => {
    const turn = neutralFallbackTurn("chosen_action", false);
    expect(Object.values(turn.extraction).every((v) => v === null)).toBe(true);
    expect(Object.values(turn.field_evidence).every((arr) => arr.length === 0)).toBe(true);
    expect(turn.candidate_driver).toBe("unclear");
  });
});
