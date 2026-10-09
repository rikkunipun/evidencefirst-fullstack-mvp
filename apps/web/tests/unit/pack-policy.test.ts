import { describe, expect, it } from "vitest";
import { PACK_POLICIES } from "../../lib/pack-policy";
import { EVIDENCE_PACKS } from "../../lib/evidence";

describe("pack policy structural integrity (draft, pending researcher review)", () => {
  it("every policy's packId/packVersion matches a real, enabled evidence pack", () => {
    for (const policy of Object.values(PACK_POLICIES)) {
      const pack = EVIDENCE_PACKS[policy.packId];
      expect(pack, `no evidence pack for policy ${policy.packId}`).toBeTruthy();
      expect(pack.enabled).toBe(true);
      expect(pack.version).toBe(policy.packVersion);
    }
  });

  it("every groundedInClaimIds entry references a real claim ID in that same pack", () => {
    for (const policy of Object.values(PACK_POLICIES)) {
      const pack = EVIDENCE_PACKS[policy.packId];
      const realIds = new Set(pack.claims.map((c) => c.id));
      for (const kind of policy.allowedKinds) {
        for (const claimId of kind.groundedInClaimIds) {
          expect(realIds.has(claimId), `${policy.packId}/${kind.id} grounds in nonexistent claim ${claimId}`).toBe(true);
        }
      }
    }
  });

  it("every kind has a nonempty groundedInClaimIds list — no ungrounded kind", () => {
    for (const policy of Object.values(PACK_POLICIES)) {
      for (const kind of policy.allowedKinds) {
        expect(kind.groundedInClaimIds.length).toBeGreaterThan(0);
      }
    }
  });

  it("kind IDs are unique within each pack", () => {
    for (const policy of Object.values(PACK_POLICIES)) {
      const ids = policy.allowedKinds.map((k) => k.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("every enabled evidence pack with topics has a policy (no silently-uncovered pack)", () => {
    for (const pack of Object.values(EVIDENCE_PACKS)) {
      if (pack.enabled) expect(PACK_POLICIES[pack.id], `pack ${pack.id} is enabled but has no policy`).toBeTruthy();
    }
  });

  // v2 regression (2026-10-09): v1 had zero "supports" kinds anywhere,
  // which made a supported belief structurally unreachable — a
  // participant who already holds the evidence-aligned belief had
  // nothing to classify into.
  it("every pack has at least one 'supports' kind — a supported belief must be reachable", () => {
    for (const policy of Object.values(PACK_POLICIES)) {
      const hasSupports = policy.allowedKinds.some((k) => k.evidenceRelation === "supports");
      expect(hasSupports, `${policy.packId} has no supports kind`).toBe(true);
    }
  });

  // v2 regression: some_activity_better_than_none was named for the
  // SUPPORTED direction but carried the CONTRADICTS relation/description.
  // Explicit pairs — same grounding, opposite relation — so this class of
  // name/relation mismatch can't silently recur. Each pair name is
  // checked directly rather than parsed from the id string, which is more
  // reliable than a naming-convention heuristic.
  const EXPECTED_PAIRS: { packId: string; contradicts: string; supports: string }[] = [
    { packId: "activity", contradicts: "some_activity_no_value", supports: "some_activity_better_than_none" },
    { packId: "activity", contradicts: "short_chunks_dont_count", supports: "short_chunks_count" },
    { packId: "activity", contradicts: "walking_not_aerobic", supports: "walking_counts_aerobic" },
    { packId: "activity", contradicts: "equipment_required_for_strength", supports: "equipment_not_required_for_strength" },
    { packId: "activity", contradicts: "weekly_distribution_not_recommended", supports: "weekly_accumulation_counts" },
    { packId: "activity", contradicts: "activity_requires_gym_or_vigorous", supports: "activity_without_gym_counts" },
    { packId: "study", contradicts: "practice_testing_no_benefit", supports: "practice_testing_helps" },
    { packId: "study", contradicts: "spacing_no_benefit", supports: "spacing_helps" },
    { packId: "study", contradicts: "rereading_highly_effective", supports: "rereading_low_utility" },
    { packId: "study", contradicts: "highlighting_highly_effective", supports: "highlighting_low_utility" },
    { packId: "study", contradicts: "low_utility_means_never_helps", supports: "low_utility_can_still_help_sometimes" },
    { packId: "learning", contradicts: "style_matching_improves_learning", supports: "style_matching_no_reliable_benefit" },
  ];

  it("every contradicts kind has a named supports mirror, grounded in the exact same claim IDs", () => {
    for (const pair of EXPECTED_PAIRS) {
      const policy = PACK_POLICIES[pair.packId];
      const contradictsKind = policy.allowedKinds.find((k) => k.id === pair.contradicts);
      const supportsKind = policy.allowedKinds.find((k) => k.id === pair.supports);
      expect(contradictsKind, `${pair.packId}/${pair.contradicts} missing`).toBeTruthy();
      expect(supportsKind, `${pair.packId}/${pair.supports} missing`).toBeTruthy();
      expect(contradictsKind!.evidenceRelation).toBe("contradicts");
      expect(supportsKind!.evidenceRelation).toBe("supports");
      expect(supportsKind!.groundedInClaimIds.slice().sort()).toEqual(contradictsKind!.groundedInClaimIds.slice().sort());
    }
  });

  // Catches exactly the bug the user found: an id naming one direction
  // while the relation/description describe the other. A bare keyword
  // heuristic is unreliable on its own — "equipment_not_required" is a
  // negation that IS the supported/correct direction — so negated ids are
  // explicitly allowlisted when the negation itself matches the pack's
  // finding (i.e. the kind's own description, not just its id, is what's
  // authoritative; this list is a hand-checked cross-reference of the two).
  const NEGATION_IS_SUPPORTED: ReadonlySet<string> = new Set(["equipment_not_required_for_strength", "style_matching_no_reliable_benefit"]);
  const NEGATION_MARKERS = ["_no_", "_not_", "_dont_", "_doesnt_", "_never_", "_zero_", "_requires_", "_required_", "no_value", "not_recommended", "not_aerobic"];
  it("every kind's id polarity is consistent with its own evidenceRelation (no v1-style name/relation mismatch)", () => {
    for (const policy of Object.values(PACK_POLICIES)) {
      for (const kind of policy.allowedKinds) {
        if (NEGATION_IS_SUPPORTED.has(kind.id)) continue;
        const hasNegationMarker = NEGATION_MARKERS.some((m) => kind.id.includes(m));
        if (hasNegationMarker) {
          // An id describing an overclaim/negation (e.g. "...no_benefit",
          // "...not_aerobic") must be the one the pack's evidence
          // contradicts or qualifies — never "supports" a negation of
          // the pack's own finding.
          expect(["contradicts", "qualifies"], `${policy.packId}/${kind.id} has a negation marker but relation is ${kind.evidenceRelation}`).toContain(kind.evidenceRelation);
        }
      }
    }
  });
});
