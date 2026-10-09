/**
 * CLEARLY LABELLED DEBUG SCRIPT — drives one session through discovery
 * through auto-deliver against a locally running `npm run dev` + the real
 * DB/model, printing every intermediate response and the raw DB rows
 * right before the auto-deliver call, so a server_error's real cause is
 * visible without re-running the full Playwright suite. Not cleaned up
 * automatically — prints the session id for manual cleanup. Not part of
 * CI; costs real tokens.
 *
 *   npm run dev &
 *   npx tsx scripts/debug-auto-deliver.ts
 */
import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const BASE = "http://localhost:3000";
async function postJson(url: string, body: unknown, cookie: string) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
  const created = await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consentVersion: "v2", situationCard: "work", goal: null, decisionCueId: "activity_fit" }),
  });
  const createdBody = await created.json();
  const sessionId = createdBody.sessionId;
  const cookie = `ef_session=${createdBody.sessionId}.${createHmac("sha256", process.env.SESSION_TOKEN_SECRET!).update(sessionId).digest("base64url")}`;
  console.log("session:", sessionId);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await supabase.from("sessions").update({ is_test: true, test_run_id: "debug-auto-deliver" }).eq("id", sessionId);

  const answers = [
    "I skipped the gym during a work trip this week and did no exercise at all instead of going to the gym.",
    "I expected I would lose consistency and struggle to get back into my routine without gym equipment and other people around.",
    "I've tried home workouts before and always gave up after a few days without the gym atmosphere and friends there.",
    "Yes, it actually happened — I did zero workouts that whole week and felt like I lost momentum.",
    "When I went back three days later I could only lift about 70% of my normal weight, so I lost real strength.",
  ];
  let turn = await postJson(`${BASE}/api/sessions/${sessionId}/messages`, { content: null }, cookie);
  for (const answer of answers) {
    if (turn.body.done) break;
    turn = await postJson(`${BASE}/api/sessions/${sessionId}/messages`, { content: answer }, cookie);
  }
  console.log("discovery done, nextStep:", turn.body.nextStep);

  const snapshotRes = await fetch(`${BASE}/api/sessions/${sessionId}`, { headers: { Cookie: cookie } });
  const snapshot = await snapshotRes.json();
  console.log("generatedDecisionNarrative:", snapshot.beliefConfirmation.generatedDecisionNarrative);
  console.log("generatedEmpiricalClaim:", snapshot.beliefConfirmation.generatedEmpiricalClaim);

  const confirm = await postJson(
    `${BASE}/api/sessions/${sessionId}/confirm`,
    {
      decisionNarrative: snapshot.beliefConfirmation.generatedDecisionNarrative,
      empiricalClaim: "I expected that brisk walking cannot count as moderate-intensity aerobic activity under adult activity recommendations.",
    },
    cookie,
  );
  console.log("confirm:", confirm.status, JSON.stringify(confirm.body));

  const eligibility = await postJson(
    `${BASE}/api/sessions/${sessionId}/eligibility`,
    {
      stillHoldsBelief: true,
      scopeAndTime: "general fitness consistency, this month",
      materiallyAffectedDecision: true,
      consequenceOccurred: true,
      consequenceEvidence: "lifted about 70% of normal weight three days after returning",
    },
    cookie,
  );
  console.log("eligibility:", eligibility.status, JSON.stringify(eligibility.body));

  const baseline = await postJson(`${BASE}/api/sessions/${sessionId}/baseline`, { baselineScore: 9 }, cookie);
  console.log("baseline:", baseline.status, JSON.stringify(baseline.body));

  const reason = "Without the gym environment, equipment, and other people around, I cannot stay consistent with exercise.";
  const r1 = await postJson(`${BASE}/api/sessions/${sessionId}/crux`, { action: "submit_reason", stage: "reason", reason }, cookie);
  console.log("crux reason:", r1.status, JSON.stringify(r1.body));
  const r2 = await postJson(`${BASE}/api/sessions/${sessionId}/crux`, { action: "confirm_reason", stage: "confirm", confirmedReason: reason }, cookie);
  console.log("crux confirm:", r2.status, JSON.stringify(r2.body));
  const hyp = await postJson(`${BASE}/api/sessions/${sessionId}/crux`, { action: "submit_hypothetical", stage: "hypothetical", hypotheticalScore: 4 }, cookie);
  console.log("crux hyp:", hyp.status, JSON.stringify(hyp.body));

  const preEvidence = await postJson(`${BASE}/api/sessions/${sessionId}/pre-evidence`, { score: 9 }, cookie);
  console.log("pre-evidence:", preEvidence.status, JSON.stringify(preEvidence.body));

  // Direct DB check right before calling auto-deliver.
  const { data: conf } = await supabase.from("belief_confirmations").select("*").eq("session_id", sessionId).order("revision", { ascending: false }).limit(1);
  console.log("DB confirmation row:", JSON.stringify(conf));
  const { data: bl } = await supabase.from("baseline_snapshots").select("*").eq("session_id", sessionId);
  console.log("DB baseline row:", JSON.stringify(bl));
  const { data: el } = await supabase.from("eligibility_evaluations").select("disposition, created_at").eq("session_id", sessionId).order("created_at", { ascending: false });
  console.log("DB eligibility rows:", JSON.stringify(el));

  const auto = await postJson(`${BASE}/api/sessions/${sessionId}/auto-deliver`, {}, cookie);
  console.log("auto-deliver:", auto.status, JSON.stringify(auto.body));

  console.log("\nSESSION ID FOR MANUAL CLEANUP:", sessionId);
}

main().catch((e) => console.error(e));
