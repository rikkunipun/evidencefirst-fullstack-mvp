import { describe, expect, it } from "vitest";
import { buildPermutedBlock, consumeNextSlot, type AssignmentBlockState } from "../../lib/assignment";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

describe("buildPermutedBlock", () => {
  it("produces exactly 1:1 fixed/personalized for an even block size", () => {
    const block = buildPermutedBlock(10, seededRandom(42));
    expect(block.length).toBe(10);
    expect(block.filter((c) => c === "fixed").length).toBe(5);
    expect(block.filter((c) => c === "personalized").length).toBe(5);
  });

  it("rejects an odd block size", () => {
    expect(() => buildPermutedBlock(9, seededRandom(1))).toThrow();
  });

  it("is deterministic for a given random source (reproducible sequence)", () => {
    const a = buildPermutedBlock(10, seededRandom(7));
    const b = buildPermutedBlock(10, seededRandom(7));
    expect(a).toEqual(b);
  });

  it("different seeds can produce different orders (not a fixed constant sequence)", () => {
    const a = buildPermutedBlock(10, seededRandom(1));
    const b = buildPermutedBlock(10, seededRandom(999));
    expect(a).not.toEqual(b);
  });
});

describe("consumeNextSlot", () => {
  it("returns slots in sequence order and flags exhaustion on the last slot", () => {
    const sequence = buildPermutedBlock(4, seededRandom(5));
    const state: AssignmentBlockState = { sequence, consumed: 0 };
    const first = consumeNextSlot(state);
    expect(first.condition).toBe(sequence[0]);
    expect(first.blockPosition).toBe(0);
    expect(first.blockExhausted).toBe(false);

    const last = consumeNextSlot({ sequence, consumed: 3 });
    expect(last.blockExhausted).toBe(true);
  });

  it("throws once the block is fully consumed", () => {
    const sequence = buildPermutedBlock(2, seededRandom(3));
    expect(() => consumeNextSlot({ sequence, consumed: 2 })).toThrow();
  });
});
