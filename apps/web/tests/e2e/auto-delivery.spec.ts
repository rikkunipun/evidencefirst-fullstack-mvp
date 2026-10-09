import { test, expect, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

/**
 * Removing the mandatory human-review dependency — full test matrix, no
 * researcher login anywhere (that's the point). Against the REAL OpenAI
 * API and the real Supabase project — not mocked. Every session is
 * marked is_test and cleaned up, pass or fail.
 */

async function postJson(request: APIRequestContext, url: string, body: unknown) {
  const res = await request.post(url, { data: body });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

async function markIsTest(sessionId: string, testRunId: string) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await supabase.from("sessions").update({ is_test: true, test_run_id: testRunId }).eq("id", sessionId);
}

async function cleanupSession(sessionId: string) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: s } = await supabase.from("sessions").select("participant_id").eq("id", sessionId).maybeSingle();
  const tables = [
    "followups",
    "deliveries",
    "measurements",
    "crux_classifications",
    "crux_passes",
    "baseline_snapshots",
    "eligibility_evaluations",
    "belief_confirmations",
    "extraction_snapshots",
    "messages",
    "context_answers",
    "consent_events",
    "assignments",
  ];
  for (const t of tables) await supabase.from(t).delete().eq("session_id", sessionId);
  const { data: drafts } = await supabase.from("draft_revisions").select("id").eq("session_id", sessionId);
  for (const d of drafts ?? []) await supabase.from("approvals").delete().eq("draft_revision_id", d.id);
  await supabase.from("draft_revisions").delete().eq("session_id", sessionId);
  await supabase.from("audit_events").delete().eq("entity_id", sessionId);
  await supabase.from("sessions").delete().eq("id", sessionId);
  if (s) await supabase.from("participants").delete().eq("id", s.participant_id);
}

/** Drives one session from creation through pre-evidence/assignment —
 * same proven scripted story as eligible-activity-flow.spec.ts. Returns
 * the session id with state='assigned' and lets the caller override the
 * confirmed empirical claim (the participant is always allowed to edit
 * it) to target a specific policy kind for classification testing,
 * independent of whatever the discovery loop itself produced. */
async function driveToAssigned(request: APIRequestContext, testRunId: string, empiricalClaimOverride?: string): Promise<string> {
  const created = await postJson(request, "/api/sessions", { consentVersion: "v2", situationCard: "work", goal: null, decisionCueId: "activity_fit" });
  expect(created.status).toBe(200);
  const sessionId: string = created.body.sessionId;
  await markIsTest(sessionId, testRunId);

  const answers = [
    "I skipped the gym during a work trip this week and did no exercise at all instead of going to the gym.",
    "I expected I would lose consistency and struggle to get back into my routine without gym equipment and other people around.",
    "I've tried home workouts before and always gave up after a few days without the gym atmosphere and friends there.",
    "Yes, it actually happened — I did zero workouts that whole week and felt like I lost momentum.",
    "When I went back three days later I could only lift about 70% of my normal weight, so I lost real strength.",
  ];
  let turn = await postJson(request, `/api/sessions/${sessionId}/messages`, { content: null });
  for (const answer of answers) {
    if (turn.body.done) break;
    turn = await postJson(request, `/api/sessions/${sessionId}/messages`, { content: answer });
  }
  expect(turn.body.nextStep).toBe("confirmation");

  const snapshotRes = await request.get(`/api/sessions/${sessionId}`);
  const snapshot = await snapshotRes.json();
  const confirm = await postJson(request, `/api/sessions/${sessionId}/confirm`, {
    decisionNarrative: snapshot.beliefConfirmation.generatedDecisionNarrative,
    empiricalClaim: empiricalClaimOverride ?? snapshot.beliefConfirmation.generatedEmpiricalClaim,
  });
  expect(confirm.status).toBe(200);

  const eligibility = await postJson(request, `/api/sessions/${sessionId}/eligibility`, {
    stillHoldsBelief: true,
    scopeAndTime: "general fitness consistency, this month",
    materiallyAffectedDecision: true,
    consequenceOccurred: true,
    consequenceEvidence: "lifted about 70% of normal weight three days after returning",
  });
  expect(eligibility.body.disposition).toBe("eligible");

  await postJson(request, `/api/sessions/${sessionId}/baseline`, { baselineScore: 9 });

  const reason = "Without the gym environment, equipment, and other people around, I cannot stay consistent with exercise.";
  await postJson(request, `/api/sessions/${sessionId}/crux`, { action: "submit_reason", stage: "reason", reason });
  await postJson(request, `/api/sessions/${sessionId}/crux`, { action: "confirm_reason", stage: "confirm", confirmedReason: reason });
  const hyp = await postJson(request, `/api/sessions/${sessionId}/crux`, { action: "submit_hypothetical", stage: "hypothetical", hypotheticalScore: 4 });
  expect(hyp.body.nextStep).toBe("pre_evidence");

  const preEvidence = await postJson(request, `/api/sessions/${sessionId}/pre-evidence`, { score: 9 });
  expect(preEvidence.status).toBe(200);

  return sessionId;
}

test.describe("Auto-delivery test matrix (no researcher login anywhere)", () => {
  test("(a)+(b) a SUPPORTED claim reaches evidence, measurement, and receipt; score is free to stay unchanged or increase", async ({ request }) => {
    test.setTimeout(180_000);
    // Policy v2: this is a supports-direction claim (short chunks of
    // activity count), not a contradicts one — proving a supported
    // belief is actually reachable through the full pipeline, not just
    // in the unit-level policy table.
    const sessionId = await driveToAssigned(
      request,
      "e2e-auto-delivers",
      "I expected that three separate short walks spread across the day still add up and count toward my weekly activity, the same as one longer session.",
    );
    try {
      const auto = await postJson(request, `/api/sessions/${sessionId}/auto-deliver`, {});
      expect(auto.status).toBe(200);
      expect(auto.body.outcome).toBe("delivered");

      const snapshotRes = await request.get(`/api/sessions/${sessionId}`);
      const snapshot = await snapshotRes.json();
      expect(snapshot.session.state).toBe("delivered");
      expect(snapshot.delivery.claimIds.length).toBeGreaterThan(0);
      expect(snapshot.delivery.sourceMap.length).toBeGreaterThan(0);
      expect(snapshot.delivery.sourceMap.every((s: { url: string }) => s.url)).toBe(true);

      // No admin action anywhere — approval record is a system decision,
      // and this is specifically the SUPPORTS direction (policy v2 fix).
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const { data: approvalRows } = await supabase.from("approvals").select("is_system, reviewer_email, evidence_relation, policy_version, pack_version").eq("id", (await supabase.from("deliveries").select("approval_id").eq("session_id", sessionId).single()).data!.approval_id);
      expect(approvalRows?.[0].is_system).toBe(true);
      expect(approvalRows?.[0].reviewer_email).toBeNull();
      expect(approvalRows?.[0].evidence_relation).toBe("supports");

      const ack = await postJson(request, `/api/sessions/${sessionId}/ack`, {});
      expect(ack.status).toBe(200);

      // (b): submitting a score equal to baseline (unchanged) must be
      // accepted — nothing in the pipeline forces a decrease.
      const post = await postJson(request, `/api/sessions/${sessionId}/measurements`, { score: 9, explanation: "Still confident.", reportedBehavior: "No change planned." });
      expect(post.status).toBe(200);

      const receiptRes = await request.get(`/api/sessions/${sessionId}/receipt`);
      const receipt = await receiptRes.json();
      expect(receipt.scores.baseline).toBe(9);
      expect(receipt.scores.postEvidence).toBe(9);
      expect(receipt.reviewType).toBe("automatic");
    } finally {
      await cleanupSession(sessionId);
    }
  });

  test("(d)+(g) a claim matching no policy kind (out-of-scope gym-equivalence) ends discovery-only with zero claims, never a human queue", async ({ request }) => {
    test.setTimeout(180_000);
    const sessionId = await driveToAssigned(
      request,
      "e2e-auto-discovery-only",
      "I expected my bodyweight home workout gives me identical results to my personal trainer's specific gym program.",
    );
    try {
      const auto = await postJson(request, `/api/sessions/${sessionId}/auto-deliver`, {});
      expect(auto.status).toBe(200);
      expect(auto.body.outcome).toBe("parked");
      expect(auto.body.reason).toBe("We don't have suitable verified evidence for this exact claim.");

      const snapshotRes = await request.get(`/api/sessions/${sessionId}`);
      const snapshot = await snapshotRes.json();
      expect(snapshot.session.state).toBe("parked");
      expect(snapshot.session.parkReason).toBe("We don't have suitable verified evidence for this exact claim.");
      expect(snapshot.delivery).toBeNull();

      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const { count } = await supabase.from("deliveries").select("*", { count: "exact", head: true }).eq("session_id", sessionId);
      expect(count).toBe(0);
      // Never labelled a preference, never queued for a human.
      expect(snapshot.session.parkReason.toLowerCase()).not.toContain("preference");
    } finally {
      await cleanupSession(sessionId);
    }
  });

  test("(f) refresh after delivery is idempotent — no re-classification, no duplicate", async ({ request }) => {
    test.setTimeout(180_000);
    const sessionId = await driveToAssigned(request, "e2e-auto-refresh", "I expected that brisk walking cannot count as moderate-intensity aerobic activity under adult activity recommendations.");
    try {
      const first = await postJson(request, `/api/sessions/${sessionId}/auto-deliver`, {});
      expect(first.body.outcome).toBe("delivered");

      const second = await postJson(request, `/api/sessions/${sessionId}/auto-deliver`, {});
      expect(second.status).toBe(200);
      expect(second.body.outcome).toBe("delivered");

      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const { count } = await supabase.from("deliveries").select("*", { count: "exact", head: true }).eq("session_id", sessionId);
      expect(count).toBe(1); // never duplicated
    } finally {
      await cleanupSession(sessionId);
    }
  });

  test("(f) withdrawal before auto-deliver blocks it outright", async ({ request }) => {
    test.setTimeout(180_000);
    const sessionId = await driveToAssigned(request, "e2e-auto-withdrawn", "I expected that brisk walking cannot count as moderate-intensity aerobic activity under adult activity recommendations.");
    try {
      const withdraw = await postJson(request, `/api/sessions/${sessionId}/withdraw`, {});
      expect(withdraw.status).toBe(200);

      const auto = await postJson(request, `/api/sessions/${sessionId}/auto-deliver`, {});
      expect(auto.status).toBe(409);

      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const { count } = await supabase.from("deliveries").select("*", { count: "exact", head: true }).eq("session_id", sessionId);
      expect(count).toBe(0); // withdrawal blocks release — nothing delivered
    } finally {
      await cleanupSession(sessionId);
    }
  });

  test("(c) a genuine preference still parks at discovery, never reaching the auto-deliver pipeline at all", async ({ request }) => {
    test.setTimeout(60_000);
    const created = await postJson(request, "/api/sessions", {
      consentVersion: "v2",
      situationCard: "school",
      goal: null,
      decisionCueId: null,
      freeText: "I chose diagrams because I enjoy pictures. I am not claiming better learning or guaranteed marks. No established past cost occurred.",
    });
    const sessionId: string = created.body.sessionId;
    await markIsTest(sessionId, "e2e-auto-preference-parks");
    try {
      const turn = await postJson(request, `/api/sessions/${sessionId}/messages`, { content: null });
      expect(turn.body.done).toBe(true);
      expect(turn.body.nextStep).toBe("parked");
      expect(turn.body.reason.length).toBeGreaterThan(0);

      const snapshotRes = await request.get(`/api/sessions/${sessionId}`);
      const snapshot = await snapshotRes.json();
      expect(snapshot.session.state).toBe("parked");
      expect(snapshot.delivery).toBeNull();
    } finally {
      await cleanupSession(sessionId);
    }
  });
});
