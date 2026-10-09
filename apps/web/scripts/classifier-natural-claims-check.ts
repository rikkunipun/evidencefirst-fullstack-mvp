/**
 * CLEARLY LABELLED REAL-MODEL TEST — 10 natural, unedited participant-style
 * claims (not written to match any policy kind's wording), run through the
 * real classifier. No DB. Costs real tokens.
 */
import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { validateClassification } from "../lib/ai/claim-classifier-pure";
import { PACK_POLICIES, type PackPolicy } from "../lib/pack-policy";

// Inlined copy of lib/ai/claim-classifier.ts's exact prompt/schema/call —
// that module is "server-only" and can't be imported from a plain script.
const classificationSchema = z.object({ classification: z.string(), rationale: z.string().max(300) });
const SYSTEM_PROMPT = `You classify a participant's confirmed, current empirical claim into exactly one closed category from a fixed list, for one specific evidence pack.

Rules:
- Return the exact id of the ONE category that matches the claim's specific content and direction, from the list given.
- If the claim does not match any category in the list, return "none".
- If it is genuinely ambiguous which category applies (could reasonably be more than one, or too vague to tell), return "unclear" — never guess, never force-match.
- Never invent a category id that is not in the given list.
- Base the decision only on the claim text and (if given) the clarification exchange. Do not use outside knowledge about whether the claim is true.
- Return only the structured object.`;

async function classifyClaim({ empiricalClaim, policy }: { empiricalClaim: string; policy: PackPolicy }) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20_000 });
  const model = process.env.OPENAI_TEXT_MODEL!;
  const userContent = JSON.stringify(
    {
      pack_id: policy.packId,
      confirmed_empirical_claim: empiricalClaim,
      allowed_categories: policy.allowedKinds.map((k) => k.id),
      category_descriptions: policy.allowedKinds.map((k) => `- ${k.id}: ${k.description}`).join("\n"),
      clarification_exchange: null,
    },
    null,
    2,
  );
  const response = await client.responses.parse({
    model,
    store: false,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    text: { format: zodTextFormat(classificationSchema, "claim_classification") },
  });
  const parsed = response.output_parsed;
  return { classification: parsed?.classification ?? "unclear", rationale: parsed?.rationale ?? "" };
}

const CASES: { label: string; pack: keyof typeof PACK_POLICIES; claim: string }[] = [
  // 3 empirical belief
  {
    label: "1. activity / empirical belief",
    pack: "activity",
    claim: "I took the stairs a few times this week instead of the elevator, but I don't think that really counts as exercise unless you're sweating buckets at a gym.",
  },
  {
    label: "2. study / empirical belief",
    pack: "study",
    claim: "I just reread my chemistry notes three times before the quiz instead of making flashcards, because I'm pretty sure doing practice questions doesn't actually help you remember stuff better.",
  },
  {
    label: "3. learning / empirical belief",
    pack: "learning",
    claim: "I always ask for diagrams instead of audio explanations because I'm a visual learner, and visual learners genuinely learn way better when the teaching matches their style.",
  },
  // 3 motivation/preference only
  {
    label: "4. activity / motivation-preference only",
    pack: "activity",
    claim: "I went for a walk instead of going to the gym because walking outside just makes me happier and I enjoy the fresh air.",
  },
  {
    label: "5. study / motivation-preference only",
    pack: "study",
    claim: "I prefer highlighting my textbook over doing flashcards because it feels more relaxing and I like using colored pens.",
  },
  {
    label: "6. learning / motivation-preference only",
    pack: "learning",
    claim: "I like watching video tutorials more than reading manuals, it's just more fun and less boring for me.",
  },
  // 2 vague
  {
    label: "7. activity / vague",
    pack: "activity",
    claim: "I've just been trying to move more lately instead of sitting around so much.",
  },
  {
    label: "8. study / vague",
    pack: "study",
    claim: "I changed how I study this semester and I think it's working out better for me.",
  },
  // 2 out-of-scope
  {
    label: "9. activity / out-of-scope (specific trainer comparison)",
    pack: "activity",
    claim: "I did my home workout instead of going to my personal trainer's gym session, and I'm sure it gave me exactly the same muscle gains as his program would have.",
  },
  {
    label: "10. learning / out-of-scope (accommodation/diagnosis)",
    pack: "learning",
    claim: "My therapist said I should get a dyslexia assessment, but I just used audio books instead of reading, and I think that fixed the issue completely.",
  },
];

async function main() {
  for (const c of CASES) {
    const policy = PACK_POLICIES[c.pack];
    const result = await classifyClaim({ empiricalClaim: c.claim, policy });
    const validated = validateClassification(result.classification, policy);
    const matchedKind = policy.allowedKinds.find((k) => k.id === validated);
    console.log(`\n${c.label}`);
    console.log(`  claim: "${c.claim}"`);
    console.log(`  raw model output: "${result.classification}"`);
    console.log(`  validated: ${validated}${matchedKind ? ` (${matchedKind.description})` : ""}`);
    console.log(`  rationale: ${result.rationale}`);
  }
}

main().catch((e) => console.error(e));
