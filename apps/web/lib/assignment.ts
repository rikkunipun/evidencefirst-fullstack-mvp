/**
 * Reproducible 1:1 permuted-block randomization. The *persisted sequence*
 * reproduces each allocation; nobody can guess assignment from a public
 * session ID. Pure functions here are unit-tested without a database.
 */

export const ASSIGNMENT_ALGORITHM_VERSION = "permuted-block-v1";

export type Condition = "fixed" | "personalized";

/** Fisher-Yates shuffle using an injected random source (crypto in production, seeded in tests). */
export function buildPermutedBlock(blockSize: number, randomSource: () => number): Condition[] {
  if (blockSize % 2 !== 0) throw new Error("blockSize must be even for 1:1 balance");
  const half = blockSize / 2;
  const block: Condition[] = [...Array(half).fill("fixed"), ...Array(half).fill("personalized")];
  for (let i = block.length - 1; i > 0; i--) {
    const j = Math.floor(randomSource() * (i + 1));
    [block[i], block[j]] = [block[j], block[i]];
  }
  return block;
}

/** Node's CSPRNG, mapped to [0, 1). Production entry point for buildPermutedBlock. */
export function cryptoRandomSource(): () => number {
  const { randomInt } = require("node:crypto") as typeof import("node:crypto");
  const SCALE = 1_000_000_000;
  return () => randomInt(0, SCALE) / SCALE;
}

export interface AssignmentBlockState {
  sequence: Condition[];
  /** Number of sequence entries already consumed by prior assignments. */
  consumed: number;
}

export interface NextAssignment {
  condition: Condition;
  blockPosition: number;
  /** True when this call consumed the last slot; caller should extend/create a new block for future sessions. */
  blockExhausted: boolean;
}

/**
 * Deterministically consumes the next unused slot. Callers must do this
 * inside a DB transaction/lock keyed by (pack_id, pack_version, protocol_version)
 * so concurrent requests cannot double-consume a slot, and must check for an
 * existing assignment row for this session first so retries are idempotent.
 */
export function consumeNextSlot(state: AssignmentBlockState): NextAssignment {
  if (state.consumed >= state.sequence.length) {
    throw new Error("Assignment block exhausted; caller must extend the block before assigning further sessions");
  }
  const condition = state.sequence[state.consumed];
  const blockPosition = state.consumed;
  const blockExhausted = state.consumed + 1 >= state.sequence.length;
  return { condition, blockPosition, blockExhausted };
}
