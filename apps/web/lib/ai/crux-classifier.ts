import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getEnv } from "../env";

export const CRUX_PROMPT_VERSION = "v1";

const classificationSchema = z.object({
  classification: z.enum(["current_claim", "near_term_test", "distant_forecast", "value_identity", "unclear"]),
  rationale: z.string().max(300),
});

const SYSTEM_PROMPT = `Classify a participant's stated reason for an expectation into exactly one category. Definitions:
- current_claim: a fact about the present or near-present that could be checked against existing evidence right now.
- near_term_test: something that could be settled by a specific, feasible personal test in the near future, but isn't yet.
- distant_forecast: a prediction about a distant or hard-to-test future state.
- value_identity: reflects a personal value, preference, or identity rather than a checkable fact.
- unclear: genuinely ambiguous between the above.
Do not invent facts about the participant. Base the classification only on the reason text given. Return only the structured object.`;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (client) return client;
  // See lib/ai/discovery.ts for why this is set explicitly — the SDK's
  // ~10 minute default was observed hanging a real call during testing.
  client = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY, timeout: 20_000 });
  return client;
}

export interface CruxClassificationResult {
  classification: z.infer<typeof classificationSchema>["classification"];
  rationale: string;
  model: string;
  promptVersion: string;
  requestId: string | null;
  latencyMs: number;
  errorMessage: string | null;
}

export async function classifyCruxReason(beliefWording: string, confirmedReason: string): Promise<CruxClassificationResult> {
  const model = getEnv().OPENAI_TEXT_MODEL;
  const start = Date.now();
  try {
    const response = await getClient().responses.parse({
      model,
      store: false,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ belief: beliefWording, reason: confirmedReason }) },
      ],
      text: { format: zodTextFormat(classificationSchema, "crux_classification") },
    });
    const parsed = response.output_parsed;
    if (!parsed) throw new Error("no parsed output");
    return { ...parsed, model, promptVersion: CRUX_PROMPT_VERSION, requestId: response.id ?? null, latencyMs: Date.now() - start, errorMessage: null };
  } catch (err) {
    return {
      classification: "unclear",
      rationale: "Classification call failed; defaulting to unclear so a researcher reviews this case.",
      model,
      promptVersion: CRUX_PROMPT_VERSION,
      requestId: null,
      latencyMs: Date.now() - start,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
