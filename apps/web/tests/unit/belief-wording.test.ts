import { describe, expect, it } from "vitest";
import { generateBeliefWording, generateDecisionNarrative, generateEmpiricalClaim, combineBeliefWording } from "../../lib/belief-wording";
import { EMPTY_FIELDS } from "../../lib/extraction-merge";

const FIELDS = { ...EMPTY_FIELDS, chosen_action: "skipping the gym", rejected_alternative: "going to the gym", expected_outcome: "losing consistency" };

describe("belief wording split (Tier 2 item 7)", () => {
  it("combining the two generated parts is byte-identical to the original single-sentence template", () => {
    const narrative = generateDecisionNarrative(FIELDS);
    const claim = generateEmpiricalClaim(FIELDS);
    expect(combineBeliefWording(narrative, claim)).toBe(generateBeliefWording(FIELDS));
    expect(generateBeliefWording(FIELDS)).toBe("I chose skipping the gym instead of going to the gym because I expected losing consistency.");
  });

  it("the decision narrative never includes the expectation, and the claim never includes the decision", () => {
    const narrative = generateDecisionNarrative(FIELDS);
    const claim = generateEmpiricalClaim(FIELDS);
    expect(narrative).not.toContain("expect");
    expect(claim).not.toContain("chose");
  });

  it("combineBeliefWording works on arbitrary (e.g. participant-edited) strings, not just generated ones", () => {
    expect(combineBeliefWording("I chose X instead of Y", "I expected Z.")).toBe("I chose X instead of Y because I expected Z.");
  });
});
