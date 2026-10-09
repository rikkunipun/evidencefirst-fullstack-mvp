import { describe, expect, it } from "vitest";
import { decideAutoDeliveryOutcome } from "../../lib/auto-delivery-decision";
import { PACK_POLICIES } from "../../lib/pack-policy";

const activityPolicy = PACK_POLICIES.activity;

describe("decideAutoDeliveryOutcome — the auto-pipeline's actual routing gate", () => {
  it("delivers with the policy's declared evidenceRelation for a real, matched kind", () => {
    const decision = decideAutoDeliveryOutcome("walking_not_aerobic", activityPolicy);
    expect(decision).toEqual({ outcome: "deliver", evidenceRelation: "contradicts" });
  });

  it("parks on 'none' — a classifiable-but-out-of-scope claim (item 3: never force-matched)", () => {
    expect(decideAutoDeliveryOutcome("none", activityPolicy)).toEqual({ outcome: "park" });
  });

  it("parks on 'unclear' — defensive, should already be resolved to 'none' upstream", () => {
    expect(decideAutoDeliveryOutcome("unclear", activityPolicy)).toEqual({ outcome: "park" });
  });

  it("parks when there is no policy for the pack at all (never crashes, never delivers blind)", () => {
    expect(decideAutoDeliveryOutcome("walking_not_aerobic", null)).toEqual({ outcome: "park" });
  });

  it("parks a kind id that isn't actually in this policy's list (defensive — validateClassification should already prevent this upstream)", () => {
    expect(decideAutoDeliveryOutcome("made_up_kind", activityPolicy)).toEqual({ outcome: "park" });
  });

  it("parks any kind whose declared evidenceRelation is 'unresolved' — never silently delivers an unresolved relation", () => {
    const policyWithUnresolved = {
      ...activityPolicy,
      allowedKinds: [...activityPolicy.allowedKinds, { id: "test_unresolved_kind", description: "test", groundedInClaimIds: ["C1"], evidenceRelation: "unresolved" as const }],
    };
    expect(decideAutoDeliveryOutcome("test_unresolved_kind", policyWithUnresolved)).toEqual({ outcome: "park" });
  });

  it("delivers for every real kind across every pack with its exact declared relation", () => {
    for (const policy of Object.values(PACK_POLICIES)) {
      for (const kind of policy.allowedKinds) {
        expect(decideAutoDeliveryOutcome(kind.id, policy)).toEqual({ outcome: "deliver", evidenceRelation: kind.evidenceRelation });
      }
    }
  });
});
