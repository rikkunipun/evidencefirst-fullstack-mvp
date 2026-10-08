import { describe, expect, it } from "vitest";
import { enforceProvenance, neutralFallbackTurn } from "../../lib/ai/discovery-pure";
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
    const result = enforceProvenance(turn, new Set(["msg-1", "msg-2"]));
    expect(result.extraction.chosen_action).toBe("skipping the gym");
  });

  it("nulls a field with zero citations even if the extracted value looks plausible", () => {
    const turn = baseTurn({ extraction: { ...EMPTY_EXTRACTION, chosen_action: "invented answer" }, field_evidence: { ...EMPTY_EVIDENCE } });
    const result = enforceProvenance(turn, new Set(["msg-1"]));
    expect(result.extraction.chosen_action).toBeNull();
  });

  it("nulls a field that cites a message ID not present in this turn's input (fabricated provenance)", () => {
    const turn = baseTurn({
      extraction: { ...EMPTY_EXTRACTION, chosen_action: "skipping the gym" },
      field_evidence: { ...EMPTY_EVIDENCE, chosen_action: ["msg-does-not-exist"] },
    });
    const result = enforceProvenance(turn, new Set(["msg-1", "msg-2"]));
    expect(result.extraction.chosen_action).toBeNull();
    expect(result.field_evidence.chosen_action).toEqual([]);
  });

  it("nulls a field if even one of several citations is invalid (all-or-nothing)", () => {
    const turn = baseTurn({
      extraction: { ...EMPTY_EXTRACTION, actual_consequence: "lost strength" },
      field_evidence: { ...EMPTY_EVIDENCE, actual_consequence: ["msg-1", "msg-fabricated"] },
    });
    const result = enforceProvenance(turn, new Set(["msg-1"]));
    expect(result.extraction.actual_consequence).toBeNull();
  });

  it("leaves an already-null field alone regardless of its (empty) evidence array", () => {
    const turn = baseTurn();
    const result = enforceProvenance(turn, new Set(["msg-1"]));
    expect(result.extraction).toEqual(EMPTY_EXTRACTION);
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
