import { describe, expect, it } from "vitest";
import { legacyDisposition, LEGACY_DISPOSITION_ALLOWED_VALUES } from "../../lib/approval-disposition";

const EVIDENCE_RELATIONS = ["supports", "qualifies", "contradicts", "unresolved", "outside_scope"] as const;

describe("legacyDisposition (Tier 2 item 8 regression)", () => {
  // Regression for a real bug: "supports" was passed straight through
  // and violated the DB's approvals_disposition_check constraint, which
  // only accepts "supported" — a mismatch a live DB round trip caught as
  // a 500, but a unit test should have caught first.
  it("every possible (briefAccurate, evidenceRelation) combination maps to a value the DB constraint accepts", () => {
    for (const briefAccurate of [true, false]) {
      for (const evidenceRelation of EVIDENCE_RELATIONS) {
        const mapped = legacyDisposition(briefAccurate, evidenceRelation);
        expect(LEGACY_DISPOSITION_ALLOWED_VALUES).toContain(mapped);
      }
    }
  });

  it("maps 'supports' to the legacy 'supported' (different words, same meaning)", () => {
    expect(legacyDisposition(true, "supports")).toBe("supported");
  });

  it("an inaccurate brief always maps to needs_clarification, regardless of evidenceRelation", () => {
    for (const evidenceRelation of EVIDENCE_RELATIONS) {
      expect(legacyDisposition(false, evidenceRelation)).toBe("needs_clarification");
    }
  });

  it("outside_scope maps to outside_scope only when the brief is accurate (false briefAccurate already forces needs_clarification)", () => {
    expect(legacyDisposition(true, "outside_scope")).toBe("outside_scope");
  });
});
