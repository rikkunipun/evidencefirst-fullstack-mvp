/**
 * CLEARLY LABELLED REAL-MODEL TEST — calls the live OpenAI model (costs
 * real tokens; not run in CI or as part of `npm run test:unit`). This is
 * the one place that checks the deterministic unit-test coverage in
 * tests/unit/discovery-pure.test.ts actually matches live model behavior
 * for the reviewer's exact failing cases, since a mocked pass alone isn't
 * proof of live reliability. No DB writes, no side effects — run manually:
 *
 *   npx tsx scripts/real-model-smoke-test.ts
 *
 * Expected (confirmed 2026-10-09 against prompt v2): caseB_factual and
 * caseA_mixedStudy both extract hasCore=true with should_stop=false
 * (continues the interview instead of blank-parking); caseC_purePreference
 * stops with stop_reason="no_stable_candidate", hasCore=false,
 * validationFailure=false (a legitimate, specifically-explained park).
 */
import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { discoveryTurnSchema, FIELD_NAMES } from "../lib/zod/discovery";
import { DISCOVERY_SYSTEM_PROMPT } from "../lib/ai/prompt.v2";
import { enforceProvenance, hasCoreFields, isValidationFailure } from "../lib/ai/discovery-pure";

const CASES: Record<string, string> = {
  caseB_factual: `Last Monday I chose the bus to a gym instead of brisk walking outside because I expected brisk walking cannot count as moderate-intensity aerobic activity in adult recommendations. I still hold that expectation. My dated tickets record 150 rupees in extra fares. I mean general qualifying adult activity, not personal adherence, equal muscle gains or medical advice.`,
  caseA_mixedStudy: `For last Friday's biology test I chose rereading instead of practice questions. I enjoy rereading, but the decisive reason was my expectation that practice testing has no general learning or retention benefit. If I expected it to help, I would have chosen practice questions despite enjoying rereading. I still hold that expectation. My dated study log records two extra hours already spent rereading. This is about general study effectiveness, not guaranteed marks.`,
  caseC_purePreference: `I chose diagrams because I enjoy pictures. I am not claiming better learning or guaranteed marks. No established past cost occurred.`,
};

async function runCase(label: string, text: string) {
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
      recent_turns: [{ id: msgId, role: "participant", content: text }],
    },
    null,
    2,
  );

  const response = await client.responses.parse({
    model,
    store: false,
    input: [
      { role: "system", content: DISCOVERY_SYSTEM_PROMPT },
      { role: "user", content: contextBlock },
    ],
    text: { format: zodTextFormat(discoveryTurnSchema, "discovery_turn") },
  });

  const parsed = response.output_parsed;
  console.log(`\n========== ${label} ==========`);
  if (!parsed) {
    console.log("NO PARSED OUTPUT");
    return;
  }
  const { turn: safe, diagnostics } = enforceProvenance(parsed, new Set([msgId]));
  const hasCore = hasCoreFields(safe.extraction);
  const validationFailure = isValidationFailure(safe, hasCore);
  console.log("should_stop:", safe.should_stop, "stop_reason:", safe.stop_reason, "candidate_driver:", safe.candidate_driver);
  console.log("hasCore:", hasCore, "validationFailure (would repair/recover, never blank-park):", validationFailure);
  console.log("fields:", JSON.stringify(safe.extraction, null, 2));
  console.log(
    "diagnostics:",
    diagnostics.map((d) => `${d.field}: hadValue=${d.hadValue} cites=${d.citationCount} resolved=${d.resolvedCitationCount} rejected=${d.rejected}`).join(" | "),
  );
}

async function main() {
  for (const [label, text] of Object.entries(CASES)) {
    await runCase(label, text);
  }
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
