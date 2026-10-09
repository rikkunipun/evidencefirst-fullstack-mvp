import { describe, expect, it } from "vitest";
import { validateClassification } from "../../lib/ai/claim-classifier-pure";
import { PACK_POLICIES } from "../../lib/pack-policy";

const activityPolicy = PACK_POLICIES.activity;

describe("validateClassification (item 3: server validates the model's output)", () => {
  it("accepts a real kind id from the pack's closed list", () => {
    expect(validateClassification("walking_not_aerobic", activityPolicy)).toBe("walking_not_aerobic");
  });

  it("accepts 'none' and 'unclear' verbatim", () => {
    expect(validateClassification("none", activityPolicy)).toBe("none");
    expect(validateClassification("unclear", activityPolicy)).toBe("unclear");
  });

  it("treats a hallucinated/unknown id as 'unclear' — never force-matched to the closest real kind", () => {
    expect(validateClassification("walking_is_aerobic", activityPolicy)).toBe("unclear");
    expect(validateClassification("totally_made_up_kind", activityPolicy)).toBe("unclear");
  });

  it("treats a kind id from a DIFFERENT pack as 'unclear' — never cross-pack matched", () => {
    const studyKindId = PACK_POLICIES.study.allowedKinds[0].id;
    expect(validateClassification(studyKindId, activityPolicy)).toBe("unclear");
  });

  it("is whitespace-tolerant but still exact otherwise", () => {
    expect(validateClassification("  walking_not_aerobic  ", activityPolicy)).toBe("walking_not_aerobic");
    expect(validateClassification("Walking_Not_Aerobic", activityPolicy)).toBe("unclear"); // case matters — exact id only
  });
});
