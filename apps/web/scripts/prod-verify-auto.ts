/**
 * CLEARLY LABELLED PRODUCTION SMOKE TEST — auto-delivery, no login
 * anywhere. 1) supports-belief story to receipt, 2) pure preference
 * (parks at discovery), 3) out-of-scope claim (discovery-only via
 * auto-deliver). Marks all three is_test. Real tokens.
 */
import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";

const BASE = "https://evidencefirst-fullstack-mvp.vercel.app";
const TEST_RUN_ID = "auto-delivery-prod-smoke-2026-10-09";

async function postJson(url: string, body: unknown, cookie: string) {
  const start = Date.now();
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
  const ms = Date.now() - start;
  return { status: res.status, body: await res.json().catch(() => ({})), ms };
}

async function createSession(situationCard: string, decisionCueId: string | null, freeText: string | null) {
  const start = Date.now();
  const res = await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consentVersion: "v2", situationCard, goal: null, decisionCueId, freeText, pilotLabel: "auto-smoke" }),
  });
  const ms = Date.now() - start;
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/ef_session=[^;]+/);
  const cookie = match ? match[0] : "";
  const body = await res.json();
  return { sessionId: body.sessionId as string, cookie, ms };
}

async function markIsTest(sessionId: string) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await supabase.from("sessions").update({ is_test: true, test_run_id: TEST_RUN_ID }).eq("id", sessionId);
}

async function runFullAutoCase(label: string, answers: string[], empiricalClaimOverride: string) {
  console.log(`\n========== ${label} ==========`);
  const times: number[] = [];
  const created = await createSession("work", "activity_fit", null);
  times.push(created.ms);
  await markIsTest(created.sessionId);
  console.log("session:", created.sessionId, "create ms:", created.ms);

  let turn = await postJson(`${BASE}/api/sessions/${created.sessionId}/messages`, { content: null }, created.cookie);
  times.push(turn.ms);
  for (const answer of answers) {
    if (turn.body.done) break;
    turn = await postJson(`${BASE}/api/sessions/${created.sessionId}/messages`, { content: answer }, created.cookie);
    times.push(turn.ms);
  }
  console.log("discovery nextStep:", turn.body.nextStep, "turn times:", times.slice(1));

  const snapshotRes = await fetch(`${BASE}/api/sessions/${created.sessionId}`, { headers: { Cookie: created.cookie } });
  const snapshot = await snapshotRes.json();
  const confirm = await postJson(
    `${BASE}/api/sessions/${created.sessionId}/confirm`,
    { decisionNarrative: snapshot.beliefConfirmation.generatedDecisionNarrative, empiricalClaim: empiricalClaimOverride },
    created.cookie,
  );
  console.log("confirm:", confirm.status, confirm.ms + "ms");

  const eligibility = await postJson(
    `${BASE}/api/sessions/${created.sessionId}/eligibility`,
    { stillHoldsBelief: true, scopeAndTime: "general fitness consistency, this month", materiallyAffectedDecision: true, consequenceOccurred: true, consequenceEvidence: "lifted about 70% of normal weight three days after returning" },
    created.cookie,
  );
  console.log("eligibility:", eligibility.status, eligibility.body.disposition, eligibility.ms + "ms");

  const baseline = await postJson(`${BASE}/api/sessions/${created.sessionId}/baseline`, { baselineScore: 9 }, created.cookie);
  console.log("baseline:", baseline.status, baseline.ms + "ms");

  const reason = "Without the gym environment, equipment, and other people around, I cannot stay consistent with exercise.";
  await postJson(`${BASE}/api/sessions/${created.sessionId}/crux`, { action: "submit_reason", stage: "reason", reason }, created.cookie);
  await postJson(`${BASE}/api/sessions/${created.sessionId}/crux`, { action: "confirm_reason", stage: "confirm", confirmedReason: reason }, created.cookie);
  const hyp = await postJson(`${BASE}/api/sessions/${created.sessionId}/crux`, { action: "submit_hypothetical", stage: "hypothetical", hypotheticalScore: 4 }, created.cookie);
  console.log("crux hyp nextStep:", hyp.body.nextStep, hyp.ms + "ms");

  const preEvidence = await postJson(`${BASE}/api/sessions/${created.sessionId}/pre-evidence`, { score: 9 }, created.cookie);
  console.log("pre-evidence:", preEvidence.status, preEvidence.ms + "ms");

  const auto = await postJson(`${BASE}/api/sessions/${created.sessionId}/auto-deliver`, {}, created.cookie);
  console.log("auto-deliver:", auto.status, JSON.stringify(auto.body), auto.ms + "ms");

  if (auto.body.outcome === "delivered") {
    const ack = await postJson(`${BASE}/api/sessions/${created.sessionId}/ack`, {}, created.cookie);
    console.log("ack:", ack.status, ack.ms + "ms");
    const measure = await postJson(`${BASE}/api/sessions/${created.sessionId}/measurements`, { score: 9, explanation: "Still confident.", reportedBehavior: "No change planned." }, created.cookie);
    console.log("measurements:", measure.status, measure.ms + "ms");
    const receiptStart = Date.now();
    const receiptRes = await fetch(`${BASE}/api/sessions/${created.sessionId}/receipt`, { headers: { Cookie: created.cookie } });
    const receipt = await receiptRes.json();
    console.log("receipt ms:", Date.now() - receiptStart, "reviewType:", receipt.reviewType, "deliveredText present:", Boolean(receipt.deliveredText));
  }

  return { sessionId: created.sessionId, auto, cookie: created.cookie };
}

async function runPreferenceCase() {
  console.log(`\n========== pure preference (should park at discovery) ==========`);
  const created = await createSession("school", null, "I chose diagrams because I enjoy pictures. I am not claiming better learning or guaranteed marks. No established past cost occurred.");
  await markIsTest(created.sessionId);
  console.log("session:", created.sessionId, "create ms:", created.ms);
  const turn = await postJson(`${BASE}/api/sessions/${created.sessionId}/messages`, { content: null }, created.cookie);
  console.log("turn:", turn.status, JSON.stringify(turn.body), turn.ms + "ms");
  return created.sessionId;
}

async function main() {
  // 1. Supports-belief story to receipt.
  const supports = await runFullAutoCase(
    "1. supports-belief story -> receipt",
    [
      "I skipped the gym during a work trip this week and did no exercise at all instead of going to the gym.",
      "I expected I would lose consistency and struggle to get back into my routine without gym equipment and other people around.",
      "I've tried home workouts before and always gave up after a few days without the gym atmosphere and friends there.",
      "Yes, it actually happened — I did zero workouts that whole week and felt like I lost momentum.",
      "When I went back three days later I could only lift about 70% of my normal weight, so I lost real strength.",
    ],
    "I expected that three separate short walks spread across the day still add up and count toward my weekly activity, the same as one longer session.",
  );

  // 2. Pure preference (parks).
  await runPreferenceCase();

  // 3. Out-of-scope claim (discovery-only via auto-deliver).
  const outOfScope = await runFullAutoCase(
    "3. out-of-scope claim -> discovery-only",
    [
      "I skipped the gym during a work trip this week and did no exercise at all instead of going to the gym.",
      "I expected I would lose consistency and struggle to get back into my routine without gym equipment and other people around.",
      "I've tried home workouts before and always gave up after a few days without the gym atmosphere and friends there.",
      "Yes, it actually happened — I did zero workouts that whole week and felt like I lost momentum.",
      "When I went back three days later I could only lift about 70% of my normal weight, so I lost real strength.",
    ],
    "I expected my bodyweight home workout gives me identical results to my personal trainer's specific gym program.",
  );

  console.log("\nSESSION IDS:", { supports: supports.sessionId, outOfScope: outOfScope.sessionId });
}

main().catch((e) => console.error(e));
