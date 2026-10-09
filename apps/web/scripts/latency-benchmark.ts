/**
 * CLEARLY LABELLED REAL-MODEL TEST — isolated latency benchmark, not part
 * of the app or CI. Measures wall-clock model-call time at different
 * reasoning efforts for the SAME model (never switches model — Tier 1
 * item 3 explicitly forbids that without asking first). Costs real tokens.
 *
 *   npx tsx scripts/latency-benchmark.ts
 */
import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { discoveryTurnSchema, FIELD_NAMES } from "../lib/zod/discovery";
import { DISCOVERY_SYSTEM_PROMPT } from "../lib/ai/prompt.v2";

const TEXT = `Last Monday I chose the bus to a gym instead of brisk walking outside because I expected brisk walking cannot count as moderate-intensity aerobic activity in adult recommendations. I still hold that expectation. My dated tickets record 150 rupees in extra fares.`;

async function timedCall(effort: "minimal" | "low" | "medium" | undefined) {
  const msgId = "11111111-1111-4111-8111-111111111111";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_TEXT_MODEL!;
  const contextBlock = JSON.stringify(
    {
      situation_card: "health",
      goal: null,
      decision_cue: null,
      current_fields: Object.fromEntries(FIELD_NAMES.map((f) => [f, null])),
      next_missing_field_hint: "chosen_action",
      questions_asked_so_far: 0,
      question_budget: 6,
      valid_participant_message_ids: [msgId],
      recent_turns: [{ id: msgId, role: "participant", content: TEXT }],
    },
    null,
    2,
  );
  const start = Date.now();
  await client.responses.parse({
    model,
    store: false,
    ...(effort ? { reasoning: { effort } } : {}),
    input: [
      { role: "system", content: DISCOVERY_SYSTEM_PROMPT },
      { role: "user", content: contextBlock },
    ],
    text: { format: zodTextFormat(discoveryTurnSchema, "discovery_turn") },
  });
  return Date.now() - start;
}

async function bench(label: string, effort: "minimal" | "low" | "medium" | undefined, n: number) {
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    try {
      times.push(await timedCall(effort));
    } catch (err) {
      console.log(`${label} attempt ${i}: ERROR — ${err instanceof Error ? err.message : err}`);
    }
  }
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : NaN;
  console.log(`${label}: n=${times.length} times=${JSON.stringify(times)} avgMs=${avg}`);
  return { label, times, avg };
}

async function main() {
  console.log("model:", process.env.OPENAI_TEXT_MODEL);
  await bench("default (no reasoning param, production-current)", undefined, 5);
  await bench("reasoning.effort=low", "low", 5);
  await bench("reasoning.effort=minimal", "minimal", 5);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
