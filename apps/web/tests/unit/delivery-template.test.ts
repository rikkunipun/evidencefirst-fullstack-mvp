import { describe, expect, it } from "vitest";
import { EVIDENCE_PACKS, selectClaims, CLAIM_COUNT } from "../../lib/evidence";
import { composeDelivery } from "../../lib/delivery-template";
import { computeContentHash } from "../../lib/content-hash";

describe("composeDelivery", () => {
  it("includes every claim's exact approved text and the pack's exact boundary text, verbatim", () => {
    const pack = EVIDENCE_PACKS.activity;
    const claims = selectClaims(pack, "fixed", "equipment");
    const content = composeDelivery(pack, claims, "I don't think I can stay consistent without gym equipment");
    for (const claim of claims) expect(content.text).toContain(claim.text);
    expect(content.text).toContain(pack.boundary);
  });

  it("delivers exactly the configured claim count for both conditions", () => {
    for (const pack of Object.values(EVIDENCE_PACKS)) {
      expect(selectClaims(pack, "fixed", "x").length).toBe(CLAIM_COUNT);
      expect(selectClaims(pack, "personalized", "x").length).toBe(CLAIM_COUNT);
    }
  });

  it("fixed and personalized word counts match within the delivered claim text itself", () => {
    const pack = EVIDENCE_PACKS.study;
    const fixed = composeDelivery(pack, selectClaims(pack, "fixed", "testing"), "testing reason");
    const personalized = composeDelivery(pack, selectClaims(pack, "personalized", "testing"), "testing reason");
    // Same claim set + same boundary + same intro template -> same total word count.
    expect(fixed.wordCount).toBe(personalized.wordCount);
  });
});

describe("computeContentHash", () => {
  it("is deterministic for identical inputs", () => {
    const a = computeContentHash("hello world", ["C1", "C2"], "v1");
    const b = computeContentHash("hello world", ["C1", "C2"], "v1");
    expect(a).toBe(b);
  });

  it("changes if the claim order changes (order matters for personalization)", () => {
    const a = computeContentHash("hello world", ["C1", "C2"], "v1");
    const b = computeContentHash("hello world", ["C2", "C1"], "v1");
    expect(a).not.toBe(b);
  });
});
