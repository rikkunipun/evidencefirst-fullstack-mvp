import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getEnv } from "../env";
import type { PackPolicy } from "../pack-policy";
export { validateClassification } from "./claim-classifier-pure";

export const CLAIM_CLASSIFIER_PROMPT_VERSION = "v1";

const classificationSchema = z.object({
  // Validated server-side against the specific pack's closed kind-id list
  // plus "none"/"unclear" — the schema itself stays a plain string because
  // the allowed set is pack-specific and built at call time (item 3: the
  // model picks from a closed list OR "none"; server code validates it).
  classification: z.string(),
  rationale: z.string().max(300),
});

const SYSTEM_PROMPT = `You classify a participant's confirmed, current empirical claim into exactly one closed category from a fixed list, for one specific evidence pack.

Rules:
- Return the exact id of the ONE category that matches the claim's specific content and direction, from the list given.
- If the claim does not match any category in the list, return "none".
- If it is genuinely ambiguous which category applies (could reasonably be more than one, or too vague to tell), return "unclear" — never guess, never force-match.
- Never invent a category id that is not in the given list.
- Base the decision only on the claim text and (if given) the clarification exchange. Do not use outside knowledge about whether the claim is true.
- Return only the structured object.`;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (client) return client;
  client = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY, timeout: 20_000 });
  return client;
}

export interface ClassifyClaimInput {
  empiricalClaim: string;
  policy: PackPolicy;
  /** A prior "unclear" result's one bounded clarification exchange, if this is the second attempt. */
  clarification?: { question: string; answer: string };
}

export interface ClassifyClaimResult {
  /** One of policy.allowedKinds[].id, "none", or "unclear" — raw model
   * output, NOT yet validated against the closed list. Callers must
   * validate before using this to route anything. */
  classification: string;
  rationale: string;
  model: string;
  promptVersion: string;
  requestId: string | null;
  latencyMs: number;
  /** Non-null only when the model call failed outright (not a normal
   * "none"/"unclear" classification) — caller treats this as "unclear"
   * for routing purposes (bounded retry, never a silent force-match). */
  errorMessage: string | null;
}

export async function classifyClaim(input: ClassifyClaimInput): Promise<ClassifyClaimResult> {
  const env = getEnv();
  const model = env.OPENAI_TEXT_MODEL;
  const start = Date.now();

  const kindList = input.policy.allowedKinds.map((k) => `- ${k.id}: ${k.description}`).join("\n");
  const userContent = JSON.stringify(
    {
      pack_id: input.policy.packId,
      confirmed_empirical_claim: input.empiricalClaim,
      allowed_categories: input.policy.allowedKinds.map((k) => k.id),
      category_descriptions: kindList,
      clarification_exchange: input.clarification ?? null,
    },
    null,
    2,
  );

  try {
    const response = await getClient().responses.parse({
      model,
      store: false,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      text: { format: zodTextFormat(classificationSchema, "claim_classification") },
    });
    const parsed = response.output_parsed;
    if (!parsed) {
      return { classification: "unclear", rationale: "", model, promptVersion: CLAIM_CLASSIFIER_PROMPT_VERSION, requestId: response.id ?? null, latencyMs: Date.now() - start, errorMessage: "Model returned no parsed output." };
    }
    return { classification: parsed.classification, rationale: parsed.rationale, model, promptVersion: CLAIM_CLASSIFIER_PROMPT_VERSION, requestId: response.id ?? null, latencyMs: Date.now() - start, errorMessage: null };
  } catch (err) {
    return {
      classification: "unclear",
      rationale: "",
      model,
      promptVersion: CLAIM_CLASSIFIER_PROMPT_VERSION,
      requestId: null,
      latencyMs: Date.now() - start,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
