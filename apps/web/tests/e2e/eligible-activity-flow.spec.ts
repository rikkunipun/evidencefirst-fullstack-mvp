import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

/**
 * Full eligible activity journey against the REAL OpenAI API and the real
 * Supabase project: discovery -> confirmation -> eligibility -> baseline ->
 * crux -> pre-evidence/assignment -> researcher login -> draft -> approve ->
 * delivered. Deletes everything it creates (session + a dedicated,
 * disposable test-researcher auth account) at the end, pass or fail.
 *
 * This is a LIVE-MODEL test, not mocked. It is slower and costs real API
 * calls; that's intentional (the brief requires at least one such check).
 *
 * IMPORTANT: this NEVER touches the real admin account's password. It
 * creates its own throwaway Supabase Auth user and requires the test
 * process's ADMIN_EMAILS to include that user's email (see README note
 * below) — never rotates credentials on a real, shared researcher account.
 */

/**
 * A fixed, dedicated, disposable test-researcher email — never the real
 * admin's. Fixed (not time-based) so it can be added to ADMIN_EMAILS
 * before the dev server starts: e.g.
 * `ADMIN_EMAILS="$ADMIN_EMAILS,ef-test-researcher@evidencefirst.test" npm run dev`
 * (a shell env var, never written to .env.local).
 */
export const E2E_TEST_RESEARCHER_EMAIL = "ef-test-researcher@evidencefirst.test";

/**
 * Creates (or recreates, if a stale one exists from a prior aborted run)
 * this dedicated test-only Supabase Auth user and returns fresh
 * credentials. This account is wholly owned by this test suite — resetting
 * its own password is not the "rotate a real/shared account's credentials"
 * action this project forbids; it never touches any other account.
 */
async function createTestResearcher(): Promise<{ email: string; password: string; userId: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const password = randomBytes(12).toString("base64url");

  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email?.toLowerCase() === E2E_TEST_RESEARCHER_EMAIL);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) throw new Error(error.message);
    return { email: E2E_TEST_RESEARCHER_EMAIL, password, userId: existing.id };
  }

  const { data, error } = await supabase.auth.admin.createUser({ email: E2E_TEST_RESEARCHER_EMAIL, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "failed to create test researcher");
  return { email: E2E_TEST_RESEARCHER_EMAIL, password, userId: data.user.id };
}

async function deleteTestResearcher(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await supabase.auth.admin.deleteUser(userId);
}

async function cleanupSession(sessionId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: s } = await supabase.from("sessions").select("participant_id").eq("id", sessionId).maybeSingle();
  const tables = [
    "followups",
    "deliveries",
    "approvals",
    "draft_revisions",
    "assignments",
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
  ];
  for (const t of tables) {
    if (t === "approvals" || t === "draft_revisions") continue; // deleted via cascade path below
    await supabase.from(t).delete().eq("session_id", sessionId);
  }
  // approvals/draft_revisions reference session indirectly; delete by session_id directly (columns exist on draft_revisions).
  const { data: drafts } = await supabase.from("draft_revisions").select("id").eq("session_id", sessionId);
  for (const d of drafts ?? []) await supabase.from("approvals").delete().eq("draft_revision_id", d.id);
  await supabase.from("draft_revisions").delete().eq("session_id", sessionId);
  await supabase.from("audit_events").delete().eq("entity_id", sessionId);
  await supabase.from("sessions").delete().eq("id", sessionId);
  if (s) await supabase.from("participants").delete().eq("id", s.participant_id);
}

async function postJson(request: APIRequestContext, url: string, body: unknown) {
  const res = await request.post(url, { data: body });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

async function markIsTest(sessionId: string, testRunId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await supabase.from("sessions").update({ is_test: true, test_run_id: testRunId }).eq("id", sessionId);
}

test("eligible activity case reaches confirmed delivery through real discovery, gates, crux, assignment, and researcher approval", async ({ page, request }) => {
  test.setTimeout(180_000);

  // 1. Consent + context.
  const created = await postJson(request, "/api/sessions", {
    consentVersion: "v1",
    situationCard: "work",
    goal: null,
    decisionCueId: "activity_fit",
  });
  expect(created.status).toBe(200);
  const sessionId: string = created.body.sessionId;
  await markIsTest(sessionId, "e2e-eligible-activity-flow");

  let testResearcherUserId: string | null = null;
  try {
    // 2. Discovery loop (real model), scripted answers, bounded by the 8-question budget.
    const answers = [
      "I skipped the gym during a work trip this week and did no exercise at all instead of going to the gym.",
      "I expected I would lose consistency and struggle to get back into my routine without gym equipment and other people around.",
      "I've tried home workouts before and always gave up after a few days without the gym atmosphere and friends there.",
      "Yes, it actually happened — I did zero workouts that whole week and felt like I lost momentum.",
      "When I went back three days later I could only lift about 70% of my normal weight, so I lost real strength.",
    ];
    let turn = await postJson(request, `/api/sessions/${sessionId}/messages`, { content: null });
    expect(turn.status).toBe(200);
    for (const answer of answers) {
      if (turn.body.done) break;
      turn = await postJson(request, `/api/sessions/${sessionId}/messages`, { content: answer });
      expect(turn.status).toBe(200);
    }
    expect(turn.body.done).toBe(true);
    expect(turn.body.nextStep).toBe("confirmation");

    // 3. Confirm the two generated parts as-is (Tier 2 item 7 split).
    const confirmGet = await request.get(`/api/sessions/${sessionId}`);
    const confirmSnapshot = await confirmGet.json();
    const generatedNarrative = confirmSnapshot.beliefConfirmation.generatedDecisionNarrative;
    const generatedClaim = confirmSnapshot.beliefConfirmation.generatedEmpiricalClaim;
    expect(generatedNarrative).toBeTruthy();
    expect(generatedClaim).toBeTruthy();
    const confirm = await postJson(request, `/api/sessions/${sessionId}/confirm`, { decisionNarrative: generatedNarrative, empiricalClaim: generatedClaim });
    expect(confirm.status).toBe(200);

    // 4. Eligibility: all six gates should pass for this scripted case.
    const eligibility = await postJson(request, `/api/sessions/${sessionId}/eligibility`, {
      stillHoldsBelief: true,
      scopeAndTime: "general fitness consistency, this month",
      materiallyAffectedDecision: true,
      consequenceOccurred: true,
      consequenceEvidence: "lifted about 70% of normal weight three days after returning",
    });
    expect(eligibility.status).toBe(200);
    expect(eligibility.body.disposition).toBe("eligible");

    // 5. Baseline freeze.
    const baseline = await postJson(request, `/api/sessions/${sessionId}/baseline`, { baselineScore: 9 });
    expect(baseline.status).toBe(200);

    // 6. Crux: one pass that carries the belief (hypothetical below baseline).
    const reason = "Without the gym environment, equipment, and other people around, I cannot stay consistent with exercise.";
    await postJson(request, `/api/sessions/${sessionId}/crux`, { action: "submit_reason", stage: "reason", reason });
    await postJson(request, `/api/sessions/${sessionId}/crux`, { action: "confirm_reason", stage: "confirm", confirmedReason: reason });
    const hyp = await postJson(request, `/api/sessions/${sessionId}/crux`, { action: "submit_hypothetical", stage: "hypothetical", hypotheticalScore: 4 });
    expect(hyp.status).toBe(200);
    expect(hyp.body.nextStep).toBe("pre_evidence");

    // 7. Pre-evidence score + idempotent assignment.
    const preEvidence = await postJson(request, `/api/sessions/${sessionId}/pre-evidence`, { score: 9 });
    expect(preEvidence.status).toBe(200);
    expect(["fixed", "personalized"]).toContain(preEvidence.body.condition);

    // 8. Researcher logs in for real through the UI, using a dedicated
    // disposable test account (never the real admin's credentials). The
    // process running this test must have ADMIN_EMAILS including this
    // email — see createTestResearcher's doc comment.
    const { email, password, userId } = await createTestResearcher();
    testResearcherUserId = userId;
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 9. Generate draft, then approve+deliver, via the authenticated browser session.
    const draft = await postJson(page.request, `/api/admin/sessions/${sessionId}/draft`, {});
    expect(draft.status).toBe(200);
    expect(draft.body.draft.claimOrder.length).toBe(5);

    const approve = await postJson(page.request, `/api/admin/sessions/${sessionId}/approve`, {
      draftRevisionId: draft.body.draft.id,
      briefAccurate: true,
      evidenceRelation: "supports",
      scopeJustification: "Activity pack directly addresses the equipment/consistency reason.",
      contentHash: draft.body.draft.contentHash,
    });
    expect(approve.status).toBe(200);
    expect(approve.body.outcome).toBe("delivered");

    // 10. Final state check.
    const finalState = await page.request.get(`/api/admin/sessions/${sessionId}`);
    const finalBody = await finalState.json();
    expect(finalBody.session.state).toBe("delivered");
    expect(finalBody.delivery.claimIds.length).toBe(5);
    expect(finalBody.delivery.exactText).toContain(draft.body.draft.renderedText.split("\n")[0]);

    // 11. Ack is required before a post-score can be submitted (participant-side, own capability cookie).
    const ack = await postJson(request, `/api/sessions/${sessionId}/ack`, {});
    expect(ack.status).toBe(200);

    // 12. Post-evidence score creates the follow-up and returns its one-time link.
    const post = await postJson(request, `/api/sessions/${sessionId}/measurements`, { score: 6, explanation: "The source/strengthening distinction changed my view.", reportedBehavior: "I'll plan a walk or bodyweight routine for my next trip." });
    expect(post.status).toBe(200);
    expect(post.body.followupUrl).toMatch(/\/follow-up\//);
    const followupToken = post.body.followupUrl.split("/follow-up/")[1];

    // 13. Follow-up correctly reports "not yet due" seven days early, and refuses early submission.
    const followupGet = await request.get(`/api/follow-up/${followupToken}`);
    expect(followupGet.status()).toBe(200);
    const followupBody = await followupGet.json();
    expect(followupBody.isDue).toBe(false);
    const earlySubmit = await postJson(request, `/api/follow-up/${followupToken}`, { score: 5, reportedBehavior: "test" });
    expect(earlySubmit.status).toBe(409);

    // 13b. Tier 2 item 10: reissue the follow-up link (simulating a lost
    // link after a refresh). The old token must stop working; the new one
    // must work in its place; due_at must be unchanged.
    const reissue = await postJson(request, `/api/sessions/${sessionId}/followup-link`, {});
    expect(reissue.status).toBe(200);
    expect(reissue.body.followupUrl).toMatch(/\/follow-up\//);
    // Same instant — compare as dates, not raw strings (the reissue route
    // reads due_at straight back from Postgres, which textually renders
    // timestamptz differently from the original `.toISOString()` call).
    expect(new Date(reissue.body.dueAt).getTime()).toBe(new Date(post.body.dueAt).getTime());
    const newToken = reissue.body.followupUrl.split("/follow-up/")[1];
    expect(newToken).not.toBe(followupToken);

    const oldTokenNowGet = await request.get(`/api/follow-up/${followupToken}`);
    expect(oldTokenNowGet.status()).toBe(404);
    const newTokenGet = await request.get(`/api/follow-up/${newToken}`);
    expect(newTokenGet.status()).toBe(200);

    // 14. Receipt download includes the frozen belief and both real scores.
    const receiptRes = await request.get(`/api/sessions/${sessionId}/receipt`);
    const receipt = await receiptRes.json();
    expect(receipt.scores.baseline).toBe(9);
    expect(receipt.scores.postEvidence).toBe(6);
    expect(receipt.frozenBelief).toBe(turn.body.generatedWording);

    // 15. Refresh/resume: a fresh GET with the same cookie reproduces the exact same state.
    const resumed = await request.get(`/api/sessions/${sessionId}`);
    const resumedBody = await resumed.json();
    expect(resumedBody.session.state).toBe("followup_due");
    expect(resumedBody.delivery.exactText).toBe(finalBody.delivery.exactText);
  } finally {
    await cleanupSession(sessionId);
    if (testResearcherUserId) await deleteTestResearcher(testResearcherUserId);
  }
});
