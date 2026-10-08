import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Short, human-shareable, collision-checked at insert time via the unique constraint. */
export function generateParticipantCode(): string {
  let code = "EF-";
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(0, ALPHABET.length)];
  return code;
}
