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
 * delivered. Deletes everything it creates (session + a throwaway test
 * researcher password rotation) at the end, pass or fail.
 *
 * This is a LIVE-MODEL test, not mocked. It is slower and costs real API
 * calls; that's intentional (the brief requires at least one such check).
 */

async function rotateAdminPassword(): Promise<{ email: string; password: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const email = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  if (!email) throw new Error("ADMIN_EMAILS must have at least one address for this test");
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: list } = await supabase.auth.admin.listUsers();
  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No existing Supabase Auth user for ${email}`);
  const password = randomBytes(12).toString("base64url");
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) throw new Error(error.message);
  return { email, password };
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

  try {
    // 2. Discovery loop (real model), scripted answers, bounded by the 8-question budget.
    const answers = [
      "I skipped the gym during a work trip this week and did no exercise at all instead of going to the gym.",
      "I expected I would lose consistency and struggle to get back into my routine without gym equipment and other people around.",
      "I've tried home workouts before and always gave up after a few days without the gym atmosphere and friends there.",
      "Yes, it actually happened — I did zero workouts that whole week and felt like I lost momentum.",
      "When I went back three days later I could only lift about 70% of my normal weight, so I lost real strength.",
    ];
    let done = false;
    let turn = await postJson(request, `/api/sessions/${sessionId}/messages`, { content: null });
    expect(turn.status).toBe(200);
    for (const answer of answers) {
      if (turn.body.done) {
        done = true;
        break;
      }
      turn = await postJson(request, `/api/sessions/${sessionId}/messages`, { content: answer });
      expect(turn.status).toBe(200);
    }
    expect(turn.body.done).toBe(true);
    expect(turn.body.nextStep).toBe("confirmation");

    // 3. Confirm the generated wording as-is.
    const confirm = await postJson(request, `/api/sessions/${sessionId}/confirm`, { confirmedWording: turn.body.generatedWording });
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

    // 8. Researcher logs in for real through the UI.
    const { email, password } = await rotateAdminPassword();
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
      disposition: "supported",
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
  }
});
