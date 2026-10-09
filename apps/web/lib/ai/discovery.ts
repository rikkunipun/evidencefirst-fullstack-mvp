import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getEnv } from "../env";
import { discoveryTurnSchema, type DiscoveryTurn, type FieldName } from "../zod/discovery";
import { DISCOVERY_SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt.v2";
import { enforceProvenance, neutralFallbackTurn, type FieldValidationDiagnostic } from "./discovery-pure";

let openaiClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY });
  return openaiClient;
}

export interface DiscoveryMessageForModel {
  id: string;
  role: "participant" | "assistant";
  content: string;
}

export interface RunDiscoveryTurnInput {
  situationCard: string;
  goal: string | null;
  decisionCue: string | null;
  recentMessages: DiscoveryMessageForModel[];
  currentFields: Record<FieldName, string | null>;
  nextMissingFieldHint: FieldName | null;
  questionsAskedSoFar: number;
  questionBudget: number;
}

export interface DiscoveryTurnResult {
  /** Always populated — either a real parsed turn or a labelled neutral fallback. */
  turn: DiscoveryTurn;
  fallback: boolean;
  model: string;
  promptVersion: string;
  requestId: string | null;
  latencyMs: number;
  errorMessage: string | null;
  /** Null when this result is a fallback (no model call succeeded) — there
   * is nothing to diagnose. Researcher-only; structural, no transcript text. */
  validationDiagnostics: FieldValidationDiagnostic[] | null;
}

function buildContextBlock(input: RunDiscoveryTurnInput): string {
  const participantMessageIds = input.recentMessages.filter((m) => m.role === "participant").map((m) => m.id);
  return JSON.stringify(
    {
      situation_card: input.situationCard,
      goal: input.goal,
      decision_cue: input.decisionCue,
      current_fields: input.currentFields,
      next_missing_field_hint: input.nextMissingFieldHint,
      questions_asked_so_far: input.questionsAskedSoFar,
      question_budget: input.questionBudget,
      valid_participant_message_ids: participantMessageIds,
      recent_turns: input.recentMessages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
    },
    null,
    2,
  );
}

export async function runDiscoveryTurn(input: RunDiscoveryTurnInput): Promise<DiscoveryTurnResult> {
  const env = getEnv();
  const model = env.OPENAI_TEXT_MODEL;
  const validParticipantMessageIds = new Set(input.recentMessages.filter((m) => m.role === "participant").map((m) => m.id));
  const budgetExhausted = input.questionsAskedSoFar >= input.questionBudget;

  if (budgetExhausted) {
    return {
      turn: neutralFallbackTurn(input.nextMissingFieldHint, true),
      fallback: true,
      model,
      promptVersion: PROMPT_VERSION,
      requestId: null,
      latencyMs: 0,
      errorMessage: null,
      validationDiagnostics: null,
    };
  }

  const start = Date.now();
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await getClient().responses.parse({
        model,
        store: false,
        input: [
          { role: "system", content: DISCOVERY_SYSTEM_PROMPT },
          { role: "user", content: buildContextBlock(input) },
        ],
        text: { format: zodTextFormat(discoveryTurnSchema, "discovery_turn") },
      });

      const parsed = response.output_parsed;
      if (!parsed) {
        lastError = "Model returned no parsed output (refusal or incomplete response).";
        continue;
      }

      const { turn: safe, diagnostics } = enforceProvenance(parsed, validParticipantMessageIds);
      return {
        turn: safe,
        fallback: false,
        model,
        promptVersion: PROMPT_VERSION,
        requestId: response.id ?? null,
        latencyMs: Date.now() - start,
        errorMessage: null,
        validationDiagnostics: diagnostics,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Exhausted one bounded repair attempt; fall back to a logged neutral
  // template question. This is explicitly labelled and never presented as
  // a successful model turn.
  return {
    turn: neutralFallbackTurn(input.nextMissingFieldHint, false),
    fallback: true,
    model,
    promptVersion: PROMPT_VERSION,
    requestId: null,
    latencyMs: Date.now() - start,
    errorMessage: lastError,
    validationDiagnostics: null,
  };
}
