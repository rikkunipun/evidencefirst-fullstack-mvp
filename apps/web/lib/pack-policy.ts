/**
 * DRAFT — REQUIRES RESEARCHER REVIEW BEFORE ANYTHING SHIPS.
 *
 * Explicit per-pack policy: the closed list of claim "kinds" each pack is
 * allowed to speak to, drafted from the pack's own `scope`/`boundary` text
 * and its claims (lib/evidence.ts) plus the 2026-10-08 audit. Each kind
 * names a SPECIFIC, DIRECTIONAL overclaim or underclaim this pack's
 * evidence actually bears on — not just a topic — because the evidence
 * relation (supports/qualifies/contradicts/unresolved) is fixed per kind,
 * not computed per participant. Kinds are deliberately paired by polarity
 * where a participant could plausibly hold either direction, so the
 * server never has to infer direction at runtime.
 *
 * The model's job (lib/ai/claim-classifier.ts) is ONLY to pick one kind id
 * from a pack's closed list, or "none" — never to invent a kind, never to
 * decide the evidence relation itself. The server looks up evidenceRelation
 * from this table; the model never reports it.
 *
 * `excludedExamples` are illustrative, not exhaustive — anything matching
 * the pack's `boundary` text in lib/evidence.ts is excluded regardless of
 * whether it's listed here.
 */

export const PACK_POLICY_VERSION = "pack-policy-v1-draft";

export type EvidenceRelation = "supports" | "qualifies" | "contradicts" | "unresolved";

export interface ClaimKindPolicy {
  id: string;
  /** What specific, directional claim this kind represents. */
  description: string;
  /** Which pack claim IDs (lib/evidence.ts) this kind's evidenceRelation is grounded in. */
  groundedInClaimIds: string[];
  evidenceRelation: EvidenceRelation;
}

export interface PackPolicy {
  packId: string;
  packVersion: string;
  allowedKinds: ClaimKindPolicy[];
  /** Illustrative claim shapes this pack must never be matched against,
   * even if a kind above looks superficially related. */
  excludedExamples: string[];
}

export const PACK_POLICIES: Record<string, PackPolicy> = {
  activity: {
    packId: "activity",
    packVersion: "2.0",
    allowedKinds: [
      {
        id: "some_activity_better_than_none",
        description: "Claims that doing some physical activity, even a small or imperfect amount, has no value compared to doing none.",
        groundedInClaimIds: ["C1"],
        evidenceRelation: "contradicts",
      },
      {
        id: "short_chunks_dont_count",
        description: "Claims that weekly activity must happen in one long block and that splitting it into shorter chunks across the day/week does not count.",
        groundedInClaimIds: ["C2", "C6"],
        evidenceRelation: "contradicts",
      },
      {
        id: "walking_not_aerobic",
        description: "Claims that brisk walking does not count as moderate-intensity aerobic activity.",
        groundedInClaimIds: ["C3"],
        evidenceRelation: "contradicts",
      },
      {
        id: "equipment_required_for_strength",
        description: "Claims that muscle-strengthening activity requires gym machines or equipment, and bodyweight exercise does not count.",
        groundedInClaimIds: ["C4"],
        evidenceRelation: "contradicts",
      },
      {
        id: "weekly_distribution_not_recommended",
        description: "Claims that spreading aerobic activity across the week (rather than one session) is not an accepted approach.",
        groundedInClaimIds: ["C6"],
        evidenceRelation: "contradicts",
      },
    ],
    excludedExamples: [
      "Claims about guaranteed personal consistency or adherence to any specific routine.",
      "Claims comparing outcomes to a specific gym program or trainer.",
      "Any claim seeking diagnosis, treatment, or individualized medical advice.",
    ],
  },
  study: {
    packId: "study",
    packVersion: "1.0",
    allowedKinds: [
      {
        id: "practice_testing_no_benefit",
        description: "Claims that practice testing / retrieval practice has no general learning or retention benefit.",
        groundedInClaimIds: ["S1"],
        evidenceRelation: "contradicts",
      },
      {
        id: "spacing_no_benefit",
        description: "Claims that distributed/spaced practice has no general learning benefit compared to cramming.",
        groundedInClaimIds: ["S2"],
        evidenceRelation: "contradicts",
      },
      {
        id: "rereading_highly_effective",
        description: "Claims that rereading notes/text is a highly effective general study technique.",
        groundedInClaimIds: ["S3"],
        evidenceRelation: "contradicts",
      },
      {
        id: "highlighting_highly_effective",
        description: "Claims that highlighting/underlining is a highly effective general study technique.",
        groundedInClaimIds: ["S4"],
        evidenceRelation: "contradicts",
      },
      {
        id: "low_utility_means_never_helps",
        description: "Claims that a technique rated low-utility in general reviews can never help in any individual context.",
        groundedInClaimIds: ["S5"],
        evidenceRelation: "contradicts",
      },
    ],
    excludedExamples: [
      "Claims about a specific exam's marks or grade outcome.",
      "Claims comparing the participant's own ability/intelligence to others.",
      "Claims about admissions decisions or institutional policy.",
    ],
  },
  learning: {
    packId: "learning",
    packVersion: "1.0",
    allowedKinds: [
      {
        id: "style_matching_improves_learning",
        description: "Claims that matching instruction to a personal learning-style label (visual, auditory, etc.) reliably improves general measured learning.",
        groundedInClaimIds: ["L1", "L2", "L5"],
        evidenceRelation: "contradicts",
      },
      {
        id: "style_matching_zero_evidence",
        description: "Claims that there is literally zero evidence of any learning benefit from style-matching under any condition.",
        groundedInClaimIds: ["L3", "L4"],
        evidenceRelation: "qualifies",
      },
    ],
    excludedExamples: [
      "Claims seeking a diagnosis or accessibility accommodation decision.",
      "Claims that one format is best for every subject/content type.",
      "Pure preference with no claim that a format produces better learning — this is not a checkable claim at all and should park as a preference during discovery, never reach this classifier.",
    ],
  },
};

export function getPackPolicy(packId: string): PackPolicy | null {
  return PACK_POLICIES[packId] ?? null;
}
