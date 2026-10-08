/**
 * Evidence packs ported verbatim (claim text, sources, locators, tags) from
 * the audited reference prototype at `dist/evidence-packs.js`
 * (commit f830f11c). Do not edit claim text here — a changed claim is a new
 * version/row in the database seed, never a silent in-place edit.
 */

export const AUDIT_DATE = "2026-10-08";

export interface EvidenceSource {
  id: string;
  title: string;
  url: string;
}

export interface EvidenceClaim {
  id: string;
  text: string;
  sourceId: string;
  sourceTitle: string;
  url: string;
  locator: string;
  evidenceNote: string;
  tags: string[];
  auditStatus: "source_checked";
  auditDate: string;
}

export interface EvidencePack {
  id: string;
  version: string;
  enabled: boolean;
  topics: string[];
  scope: string;
  boundary: string;
  claims: EvidenceClaim[];
}

const studySource: EvidenceSource = {
  id: "DUNLOSKY_2013",
  title: "Dunlosky et al. (2013) · Improving Students' Learning",
  url: "https://acs.ist.psu.edu/ist521/dunloskyRMNW13.pdf",
};
const styleSource: EvidenceSource = {
  id: "PASHLER_2008",
  title: "Pashler et al. · Learning Styles: Concepts and Evidence",
  url: "https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/Pashler_McDaniel_Rohrer_Bjork_2009_PSPI.pdf",
};
const metaSource: EvidenceSource = {
  id: "CLINTON_LISELL_2024",
  title: "Clinton-Lisell & Litzinger (2024) · Learning styles meta-analysis",
  url: "https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1428732/full",
};
const cdcSource: EvidenceSource = {
  id: "CDC_COUNTS",
  title: "CDC · What counts as physical activity for adults",
  url: "https://www.cdc.gov/physical-activity-basics/adding-adults/what-counts.html",
};
const adultSource: EvidenceSource = {
  id: "CDC_ADULTS",
  title: "CDC · Adult activity overview",
  url: "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html",
};

function unit(
  id: string,
  text: string,
  source: EvidenceSource,
  locator: string,
  evidenceNote: string,
  tags: string[],
): EvidenceClaim {
  return {
    id,
    text,
    sourceId: source.id,
    sourceTitle: source.title,
    url: source.url,
    locator,
    evidenceNote,
    tags,
    auditStatus: "source_checked",
    auditDate: AUDIT_DATE,
  };
}

export const EVIDENCE_PACKS: Record<string, EvidencePack> = {
  activity: {
    id: "activity",
    version: "2.0",
    enabled: true,
    topics: ["activity"],
    scope:
      "General adult activity: whether qualifying activity outside a gym can contribute to health, and whether machines or a single long session are required. No guaranteed personal adherence, equal gym results, diagnosis or treatment.",
    boundary:
      "These sources do not establish identical gym results or guarantee your personal consistency. Activity must meet the relevant intensity and strengthening requirements.",
    claims: [
      unit(
        "C1",
        "WHO states that doing some physical activity is better than doing none.",
        { id: "WHO_ACTIVITY", title: "WHO · Physical activity", url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity" },
        "Key facts",
        "WHO recognizes activity in multiple settings; do not infer a personal health outcome.",
        ["benefit", "health", "value"],
      ),
      unit(
        "C2",
        "CDC says adults can divide weekly physical activity into smaller chunks.",
        adultSource,
        "Recommendations for adults",
        "Smaller chunks can contribute; this is not equivalence to every gym programme.",
        ["short", "time", "minutes"],
      ),
      unit(
        "C3",
        "CDC lists brisk walking as an example of moderate-intensity aerobic activity.",
        cdcSource,
        "Aerobic activity - what counts?",
        "Brisk walking qualifies; not all walking has the same intensity.",
        ["walking", "walk", "benefit"],
      ),
      unit(
        "C4",
        "CDC lists body-weight resistance exercises as muscle-strengthening activity.",
        cdcSource,
        "Muscle strengthening - what counts?",
        "Qualifying effort and major muscle groups matter; machines are not required for every strengthening activity.",
        ["equipment", "machine", "strength"],
      ),
      unit(
        "C6",
        "CDC recommends spreading adult aerobic activity through the week.",
        adultSource,
        "Recommendations for adults",
        "Weekly distribution; no promise of individual adherence.",
        ["week", "time", "schedule"],
      ),
    ],
  },
  study: {
    id: "study",
    version: "1.0",
    enabled: true,
    topics: ["study", "skills", "childStudy"],
    scope:
      "General study technique effectiveness and retention: practice testing, spacing, rereading and highlighting. No guaranteed exam marks, individual superiority, admissions prediction or judgement of a participant's ability.",
    boundary:
      "These are review-level findings, not a guarantee of your exam result. A method with low general utility may still help in particular circumstances.",
    claims: [
      unit(
        "S1",
        "The 2013 review rated practice testing as having high utility for learning.",
        studySource,
        "Section 8.5, printed p. 35",
        "High utility judgement across reviewed formats and tasks; no individual score promise.",
        ["test", "testing", "recall", "mock"],
      ),
      unit(
        "S2",
        "The 2013 review rated distributed practice as having high utility for learning.",
        studySource,
        "Section 9.5, printed p. 39",
        "Spacing receives high utility; the review does not prescribe one universal interval.",
        ["spacing", "spaced", "time", "cram"],
      ),
      unit(
        "S3",
        "The 2013 review rated rereading as having low general utility for learning.",
        studySource,
        "Section 7.5, printed p. 29",
        "Limited generalization, especially comprehension; low utility does not mean no benefit.",
        ["reread", "rereading", "reading"],
      ),
      unit(
        "S4",
        "The 2013 review rated highlighting and underlining as having low general utility.",
        studySource,
        "Section 4.5, printed p. 21",
        "Typical use has limited benefits; effective selection and training can matter.",
        ["highlight", "underlining", "notes"],
      ),
      unit(
        "S5",
        "The review explains that a low-utility technique can still be useful in some contexts.",
        studySource,
        "Introduction, printed p. 7",
        "Ratings concern generalizability, not a claim of universal failure.",
        ["always", "never", "context", "help"],
      ),
    ],
  },
  learning: {
    id: "learning",
    version: "1.0",
    enabled: true,
    topics: ["learning"],
    scope:
      "Whether matching teaching to visual, auditory or similar modality-style labels reliably improves measured learning. Preferences, accessibility needs and content-specific formats must be preserved; no diagnosis or claim that every learner is identical.",
    boundary:
      "Your format preference can remain valid. These reviews do not settle your individual result or accessibility needs, and do not show that one format is best for every subject.",
    claims: [
      unit(
        "L1",
        "The Pashler review distinguishes study preferences from evidence that matching instruction improves learning.",
        styleSource,
        "Existence of Study Preferences, printed p. 108",
        "Preference existence does not establish an instructional matching benefit.",
        ["prefer", "preference", "enjoy"],
      ),
      unit(
        "L2",
        "The Pashler review found inadequate support for using learning-style assessments in general educational practice.",
        styleSource,
        "Conclusions, printed pp. 116-117",
        "Historical review finding; do not present it as proof that all variants were tested.",
        ["style", "visual", "auditory"],
      ),
      unit(
        "L3",
        "A 2024 meta-analysis found a small average learning benefit from matched instruction.",
        metaSource,
        "Abstract; Results",
        "A positive pooled estimate exists; it must not be hidden to force correction.",
        ["benefit", "better", "match"],
      ),
      unit(
        "L4",
        "In the 2024 meta-analysis, about 26% of learning outcome measures showed the required crossover pattern.",
        metaSource,
        "Abstract; crossover analysis",
        "This pattern supports matching for at least two styles; it was infrequent.",
        ["evidence", "reliable", "always"],
      ),
      unit(
        "L5",
        "The 2024 authors judged the benefits insufficient to justify widespread adoption, given low study quality and implementation costs.",
        metaSource,
        "Abstract; Discussion",
        "Authors' qualified adoption judgement, not proof of zero effect.",
        ["cost", "time", "quality", "style"],
      ),
    ],
  },
};

export function getEnabledPackForTopic(topic: string): EvidencePack | null {
  return Object.values(EVIDENCE_PACKS).find((p) => p.enabled && p.topics.includes(topic)) ?? null;
}

export const PROTOCOL_VERSION = "order_personalization_v1";
export const CLAIM_COUNT = 5;

/**
 * Both conditions return the same five claim objects. "Personalized" only
 * reorders them by tag overlap with the confirmed reason text, with a
 * stable tie-break on claim ID. No claim text is ever added or rewritten.
 */
export function selectClaims(pack: EvidencePack, condition: "fixed" | "personalized", confirmedReason: string): EvidenceClaim[] {
  const items = [...pack.claims];
  if (condition === "personalized") {
    const words = confirmedReason.toLowerCase();
    items.sort((a, b) => {
      const scoreA = a.tags.filter((t) => words.includes(t)).length;
      const scoreB = b.tags.filter((t) => words.includes(t)).length;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.id.localeCompare(b.id);
    });
  }
  return items;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function totalWordCount(claims: EvidenceClaim[]): number {
  return claims.reduce((n, c) => n + wordCount(c.text), 0);
}

/**
 * Reversal/verification lookup: an exact text match against an enabled
 * pack's claims. This proves library membership, not semantic truth of an
 * arbitrary paraphrase or broader assertion.
 */
export function exactSupport(packId: string, claimText: string): string[] {
  const pack = EVIDENCE_PACKS[packId];
  if (!pack?.enabled) return [];
  const trimmed = claimText.trim();
  return pack.claims.filter((c) => c.text === trimmed).map((c) => c.id);
}
