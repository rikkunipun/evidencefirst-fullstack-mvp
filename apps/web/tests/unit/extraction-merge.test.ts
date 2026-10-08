import { describe, expect, it } from "vitest";
import { mergeFields, firstMissingField, EMPTY_FIELDS } from "../../lib/extraction-merge";

describe("mergeFields", () => {
  it("a later null never erases an earlier non-null answer", () => {
    const history = [
      { ...EMPTY_FIELDS, chosen_action: "skipping the gym" },
      { ...EMPTY_FIELDS, chosen_action: null, expected_outcome: "losing consistency" },
    ];
    const merged = mergeFields(history);
    expect(merged.chosen_action).toBe("skipping the gym");
    expect(merged.expected_outcome).toBe("losing consistency");
  });

  it("a later non-null value overwrites (treated as a correction)", () => {
    const history = [{ ...EMPTY_FIELDS, chosen_action: "first answer" }, { ...EMPTY_FIELDS, chosen_action: "corrected answer" }];
    expect(mergeFields(history).chosen_action).toBe("corrected answer");
  });
});

describe("firstMissingField", () => {
  it("returns the first field name still null, in declared order", () => {
    const fields = { ...EMPTY_FIELDS, chosen_action: "x", rejected_alternative: "y" };
    expect(firstMissingField(fields)).toBe("expected_outcome");
  });

  it("returns null once every field is filled", () => {
    const fields = {
      chosen_action: "a",
      rejected_alternative: "b",
      expected_outcome: "c",
      origin_of_expectation: "d",
      actual_consequence: "e",
      consequence_evidence: "f",
    };
    expect(firstMissingField(fields)).toBeNull();
  });
});
