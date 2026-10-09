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
});
