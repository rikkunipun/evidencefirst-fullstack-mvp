/**
 * DRAFT — REQUIRES RESEARCHER REVIEW BEFORE ANYTHING SHIPS.
 *
 * Explicit per-pack policy: the closed list of claim "kinds" each pack is
 * allowed to speak to, drafted from the pack's own `scope`/`boundary` text
 * and its claims (lib/evidence.ts) plus the 2026-10-08 audit. Each kind
 * names a SPECIFIC, DIRECTIONAL claim this pack's evidence actually bears
 * on — not just a topic — because the evidence relation
 * (supports/qualifies/contradicts/unresolved) is fixed per kind, not
 * computed per participant.
 *
 * v2 (2026-10-09): v1 only had "contradicts" kinds, which made a
 * supported belief structurally impossible to reach — a participant who
 * already holds the evidence-aligned belief had nothing to classify
 * into. Every claim's two directions are now separate, paired kinds
 * (grounded in the SAME claim IDs, opposite relation) wherever a
 * participant could plausibly hold either one. v1's
 * `some_activity_better_than_none` was also a real bug fixed here: its
 * id named the SUPPORTED direction but its relation and description were
 * the CONTRADICTS direction — split into two correctly-named kinds.
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

export const PACK_POLICY_VERSION = "pack-policy-v2-draft";

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
      // --- C1: "WHO states that doing some physical activity is better than doing none." ---
      {
        id: "some_activity_no_value",
        description: "Claims that doing some physical activity, even a small or imperfect amount, has no value compared to doing none.",
        groundedInClaimIds: ["C1"],
        evidenceRelation: "contradicts",
      },
      {
        id: "some_activity_better_than_none",
        description: "Claims that doing some physical activity is better than doing none at all, even if imperfect.",
        groundedInClaimIds: ["C1"],
        evidenceRelation: "supports",
      },
      // --- C2 / C6: "adults can divide weekly physical activity into smaller chunks" / "CDC recommends spreading adult aerobic activity through the week" ---
      {
        id: "short_chunks_dont_count",
        description: "Claims that weekly activity must happen in one long block and that splitting it into shorter chunks across the day/week does not count.",
        groundedInClaimIds: ["C2", "C6"],
        evidenceRelation: "contradicts",
      },
      {
        id: "short_chunks_count",
        description: "Claims that shorter chunks of activity spread across the day or week do count toward weekly activity.",
        groundedInClaimIds: ["C2", "C6"],
        evidenceRelation: "supports",
      },
      // --- C3: "CDC lists brisk walking as an example of moderate-intensity aerobic activity." ---
      {
        id: "walking_not_aerobic",
        description: "Claims that brisk walking does not count as moderate-intensity aerobic activity.",
        groundedInClaimIds: ["C3"],
        evidenceRelation: "contradicts",
      },
      {
        id: "walking_counts_aerobic",
        description: "Claims that brisk walking does count as moderate-intensity aerobic activity.",
        groundedInClaimIds: ["C3"],
        evidenceRelation: "supports",
      },
      // --- C4: "CDC lists body-weight resistance exercises as muscle-strengthening activity." ---
      {
        id: "equipment_required_for_strength",
        description: "Claims that muscle-strengthening activity requires gym machines or equipment, and bodyweight exercise does not count.",
        groundedInClaimIds: ["C4"],
        evidenceRelation: "contradicts",
      },
      {
        id: "equipment_not_required_for_strength",
        description: "Claims that bodyweight resistance exercise, without gym machines or equipment, counts as muscle-strengthening activity.",
        groundedInClaimIds: ["C4"],
        evidenceRelation: "supports",
      },
      // --- C6: "CDC recommends spreading adult aerobic activity through the week." ---
      {
        id: "weekly_distribution_not_recommended",
        description: "Claims that spreading aerobic activity across the week (rather than one session) is not an accepted approach.",
        groundedInClaimIds: ["C6"],
        evidenceRelation: "contradicts",
      },
      {
        id: "weekly_accumulation_counts",
        description: "Claims that accumulating/spreading aerobic activity across the week, rather than one single session, is an accepted and counted approach.",
        groundedInClaimIds: ["C6"],
        evidenceRelation: "supports",
      },
      // --- C1 + C3 + C4: the general "it only counts if it's a real gym workout" overclaim, naturally stated by participants (added 2026-10-09 after a real-claim test missed it). ---
      {
        id: "activity_requires_gym_or_vigorous",
        description: "Claims that activity only counts as real/qualifying exercise if it is vigorous or happens at a gym — ordinary activity like walking or bodyweight movement outside a gym does not count.",
        groundedInClaimIds: ["C1", "C3", "C4"],
        evidenceRelation: "contradicts",
      },
      {
        id: "activity_without_gym_counts",
        description: "Claims that ordinary activity outside a gym (e.g. walking, bodyweight movement) does count as qualifying activity, without needing to be vigorous or at a gym.",
        groundedInClaimIds: ["C1", "C3", "C4"],
        evidenceRelation: "supports",
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
      // --- S1: "The 2013 review rated practice testing as having high utility for learning." ---
      {
        id: "practice_testing_no_benefit",
        description: "Claims that practice testing / retrieval practice has no general learning or retention benefit.",
        groundedInClaimIds: ["S1"],
        evidenceRelation: "contradicts",
      },
      {
        id: "practice_testing_helps",
        description: "Claims that practice testing / retrieval practice does have a general learning or retention benefit.",
        groundedInClaimIds: ["S1"],
        evidenceRelation: "supports",
      },
      // --- S2: "The 2013 review rated distributed practice as having high utility for learning." ---
      {
        id: "spacing_no_benefit",
        description: "Claims that distributed/spaced practice has no general learning benefit compared to cramming.",
        groundedInClaimIds: ["S2"],
        evidenceRelation: "contradicts",
      },
      {
        id: "spacing_helps",
        description: "Claims that distributed/spaced practice does have a general learning benefit compared to cramming.",
        groundedInClaimIds: ["S2"],
        evidenceRelation: "supports",
      },
      // --- S3: "The 2013 review rated rereading as having low general utility for learning." ---
      {
        id: "rereading_highly_effective",
        description: "Claims that rereading notes/text is a highly effective general study technique.",
        groundedInClaimIds: ["S3"],
        evidenceRelation: "contradicts",
      },
      {
        id: "rereading_low_utility",
        description: "Claims that rereading notes/text has low general utility as a study technique.",
        groundedInClaimIds: ["S3"],
        evidenceRelation: "supports",
      },
      // --- S4: "The 2013 review rated highlighting and underlining as having low general utility." ---
      {
        id: "highlighting_highly_effective",
        description: "Claims that highlighting/underlining is a highly effective general study technique.",
        groundedInClaimIds: ["S4"],
        evidenceRelation: "contradicts",
      },
      {
        id: "highlighting_low_utility",
        description: "Claims that highlighting/underlining has low general utility as a study technique.",
        groundedInClaimIds: ["S4"],
        evidenceRelation: "supports",
      },
      // --- S5: "The review explains that a low-utility technique can still be useful in some contexts." ---
      {
        id: "low_utility_means_never_helps",
        description: "Claims that a technique rated low-utility in general reviews can never help in any individual context.",
        groundedInClaimIds: ["S5"],
        evidenceRelation: "contradicts",
      },
      {
        id: "low_utility_can_still_help_sometimes",
        description: "Claims that a technique rated low-utility in general reviews can still help in some individual contexts.",
        groundedInClaimIds: ["S5"],
        evidenceRelation: "supports",
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
      // --- L1 / L2 / L5: Pashler — inadequate support for style-matching in general practice; authors judged benefits insufficient to justify adoption. ---
      {
        id: "style_matching_improves_learning",
        description: "Claims that matching instruction to a personal learning-style label (visual, auditory, etc.) reliably improves general measured learning.",
        groundedInClaimIds: ["L1", "L2", "L5"],
        evidenceRelation: "contradicts",
      },
      {
        id: "style_matching_no_reliable_benefit",
        description: "Claims that matching instruction to a personal learning-style label does not reliably improve general measured learning.",
        groundedInClaimIds: ["L1", "L2", "L5"],
        evidenceRelation: "supports",
      },
      // --- L3 / L4: 2024 meta-analysis — small average benefit found; ~26% of measures showed the crossover pattern. ---
      {
        id: "style_matching_zero_evidence",
        description: "Claims that there is literally zero evidence of any learning benefit from style-matching under any condition.",
        groundedInClaimIds: ["L3", "L4"],
        evidenceRelation: "qualifies",
      },
      {
        id: "style_matching_small_benefit_found",
        description: "Claims that a small average learning benefit from style-matched instruction has been found in some studies, though infrequent.",
        groundedInClaimIds: ["L3", "L4"],
        evidenceRelation: "supports",
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
