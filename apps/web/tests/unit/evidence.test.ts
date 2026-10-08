import { describe, expect, it } from "vitest";
import { EVIDENCE_PACKS, getEnabledPackForTopic, selectClaims, totalWordCount, exactSupport, CLAIM_COUNT } from "../../lib/evidence";

describe("evidence packs", () => {
  it("enables exactly the three audited packs, each with exactly five claims", () => {
    const packs = Object.values(EVIDENCE_PACKS);
    expect(packs.every((p) => p.enabled)).toBe(true);
    expect(packs.length).toBe(3);
    for (const pack of packs) expect(pack.claims.length).toBe(CLAIM_COUNT);
  });

  it("returns null for any topic without an enabled pack", () => {
    for (const topic of ["other", "protein", "coding", "credit", "salary"]) {
      expect(getEnabledPackForTopic(topic)).toBeNull();
    }
  });

  it("maps skills and childStudy onto the shared study pack", () => {
    expect(getEnabledPackForTopic("skills")?.id).toBe("study");
    expect(getEnabledPackForTopic("childStudy")?.id).toBe("study");
  });

  it("fixed and personalized conditions deliver the identical claim set and word count", () => {
    for (const pack of Object.values(EVIDENCE_PACKS)) {
      const fixed = selectClaims(pack, "fixed", "equipment practice testing style");
      const personalized = selectClaims(pack, "personalized", "equipment practice testing style");
      expect(fixed.map((c) => c.id).sort()).toEqual(personalized.map((c) => c.id).sort());
      expect(totalWordCount(fixed)).toBe(totalWordCount(personalized));
    }
  });

  it("personalization reorders by tag overlap without changing claim text", () => {
    const pack = EVIDENCE_PACKS.activity;
    const result = selectClaims(pack, "personalized", "Only gym equipment and machines count.");
    expect(result[0].id).toBe("C4");
    expect(result[0].text).toBe(pack.claims.find((c) => c.id === "C4")!.text);
    // Original pack order is untouched.
    expect(pack.claims[0].id).toBe("C1");
  });

  it("exact support lookup rejects paraphrases and cross-pack text", () => {
    expect(exactSupport("activity", "Walking outside a gym guarantees identical muscle growth for everyone.")).toEqual([]);
    expect(exactSupport("study", EVIDENCE_PACKS.activity.claims[0].text)).toEqual([]);
    expect(exactSupport("unknown", "anything")).toEqual([]);
  });

  it("exact support lookup accepts the precise approved claim text", () => {
    expect(exactSupport("activity", EVIDENCE_PACKS.activity.claims[0].text)).toEqual(["C1"]);
  });
});
