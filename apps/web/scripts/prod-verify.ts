/**
 * CLEARLY LABELLED PRODUCTION VERIFICATION — goes through the real public
 * /api/sessions + /api/sessions/[id]/messages flow against the deployed
 * production URL (not a DB shortcut), for three cases. Marks each created
 * session is_test=true + test_run_id afterward via direct Supabase access
 * (same mechanism as the authorized mark-test path) so it never pollutes
 * real analysis. No deletion. Costs real tokens.
 *
 *   npx tsx scripts/prod-verify.ts
 */
import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";

const BASE = "https://evidencefirst-fullstack-mvp.vercel.app";
const TEST_RUN_ID = "tier1-prod-verify-2026-10-09";

const CASES: { label: string; freeText: string; situationCard: string }[] = [
  {
    label: "mixed_study",
    situationCard: "school",
    freeText:
      "For last Friday's biology test I chose rereading instead of practice questions. I enjoy rereading, but the decisive reason was my expectation that practice testing has no general learning or retention benefit. If I expected it to help, I would have chosen practice questions despite enjoying rereading. I still hold that expectation. My dated study log records two extra hours already spent rereading. This is about general study effectiveness, not guaranteed marks.",
  },
  {
    label: "gym_activity",
    situationCard: "other",
    freeText:
      "Last Monday I chose the bus to a gym instead of brisk walking outside because I expected brisk walking cannot count as moderate-intensity aerobic activity in adult recommendations. I still hold that expectation. My dated tickets record 150 rupees in extra fares. I mean general qualifying adult activity, not personal adherence, equal muscle gains or medical advice.",
  },
  {
    label: "diagram_preference",
    situationCard: "school",
    freeText: "I chose diagrams because I enjoy pictures. I am not claiming better learning or guaranteed marks. No established past cost occurred.",
  },
];

function parseCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/ef_session=[^;]+/);
  return match ? match[0] : null;
}

async function runCase(c: (typeof CASES)[number]) {
  console.log(`\n========== ${c.label} ==========`);
  const createStart = Date.now();
  const createRes = await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consentVersion: "v1",
      situationCard: c.situationCard,
      goal: null,
      decisionCueId: null,
      freeText: c.freeText,
      pilotLabel: "tier1-verify",
    }),
  });
  const createMs = Date.now() - createStart;
  const cookie = parseCookie(createRes.headers.get("set-cookie"));
  const createBody = await createRes.json();
  const sessionId = createBody.sessionId as string;
  console.log(`create: status=${createRes.status} ms=${createMs} sessionId=${sessionId}`);
  if (!cookie || !sessionId) {
    console.log("FAILED to create session — aborting this case.");
    return { label: c.label, sessionId: null, turns: [] as number[] };
  }

  const turns: number[] = [];
  let done = false;
  let lastBody: Record<string, unknown> = {};
  // Kickoff (content=null uses the typed free-text story), then up to 5
  // more turns if the model keeps asking follow-ups.
  let content: string | null = null;
  for (let i = 0; i < 6 && !done; i++) {
    const start = Date.now();
    const res = await fetch(`${BASE}/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ content, inputMode: "text", clientToken: crypto.randomUUID() }),
    });
    const ms = Date.now() - start;
    turns.push(ms);
    lastBody = await res.json();
    console.log(`  turn ${i + 1}: status=${res.status} ms=${ms} body=${JSON.stringify(lastBody)}`);
    done = Boolean(lastBody.done) || Boolean(lastBody.recovery);
    // Answer any follow-up question neutrally and genuinely (not steering
    // toward any particular classification) so the interview can proceed.
    content = "That's the full picture — nothing more to add.";
  }

  return { label: c.label, sessionId, turns, finalBody: lastBody };
}

async function main() {
  const results = [];
  for (const c of CASES) {
    results.push(await runCase(c));
  }

  console.log("\n========== summary ==========");
  for (const r of results) {
    const avg = r.turns.length ? Math.round(r.turns.reduce((a, b) => a + b, 0) / r.turns.length) : NaN;
    console.log(`${r.label}: sessionId=${r.sessionId} turnsMs=${JSON.stringify(r.turns)} avgMs=${avg}`);
  }

  // Mark all created sessions is_test so they never pollute real analysis.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  for (const r of results) {
    if (!r.sessionId) continue;
    const { data: before } = await supabase.from("sessions").select("is_test, test_run_id").eq("id", r.sessionId).maybeSingle();
    await supabase.from("sessions").update({ is_test: true, test_run_id: TEST_RUN_ID }).eq("id", r.sessionId);
    await supabase.from("audit_events").insert({
      actor_type: "researcher",
      action: "marked_is_test",
      entity_type: "sessions",
      entity_id: r.sessionId,
      before,
      after: { is_test: true, test_run_id: TEST_RUN_ID, reason: "post-deploy Tier 1 production verification" },
    });
  }
  console.log(`\nMarked ${results.filter((r) => r.sessionId).length} session(s) is_test=true, test_run_id=${TEST_RUN_ID} (audited, not deleted).`);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
