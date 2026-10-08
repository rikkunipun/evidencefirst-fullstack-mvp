import { createHash } from "node:crypto";

/** Stable hash binding a draft's exact text to its claim order and template version, for stale-approval detection. */
export function computeContentHash(renderedText: string, claimOrder: string[], templateVersion: string): string {
  return createHash("sha256").update(JSON.stringify({ renderedText, claimOrder, templateVersion })).digest("hex");
}
