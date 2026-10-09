import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

/**
 * Tier 2 item 8's two non-"deliver" review outcomes, against the REAL
 * OpenAI API and the real Supabase project — not mocked. Covers:
 *  1. evidenceRelation="outside_scope" -> terminal refusal.
 *  2. briefAccurate=false -> actionable return to 'assigned' (not a
 *     terminal refusal), then a fresh draft + proper approval -> delivered.
 *
 * NEVER touches the real admin account's password — uses the same
 * dedicated, disposable test-researcher account as
 * eligible-activity-flow.spec.ts (create-or-reset its own password only).
 */

const E2E_TEST_RESEARCHER_EMAIL = "ef-test-researcher@evidencefirst.test";

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

async function markIsTest(sessionId: string, testRunId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await supabase.from("sessions").update({ is_test: true, test_run_id: testRunId }).eq("id", sessionId);
}

async function cleanupSession(sessionId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: s } = await supabase.from("sessions").select("participant_id").eq("id", sessionId).maybeSingle();
  const tables = [
    "followups",
    "deliveries",
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
  for (const t of tables) await supabase.from(t).delete().eq("session_id", sessionId);
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

/** Drives one session from creation through pre-evidence/assignment —
 * same proven scripted story as eligible-activity-flow.spec.ts, reused
 * here since these tests only diverge at the review step. */
async function driveToAssigned(request: APIRequestContext, testRunId: string): Promise<string> {
  const created = await postJson(request, "/api/sessions", { consentVersion: "v1", situationCard: "work", goal: null, decisionCueId: "activity_fit" });
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
  expect(turn.body.done).toBe(true);
  expect(turn.body.nextStep).toBe("confirmation");

  const snapshotRes = await request.get(`/api/sessions/${sessionId}`);
  const snapshot = await snapshotRes.json();
  const confirm = await postJson(request, `/api/sessions/${sessionId}/confirm`, {
    decisionNarrative: snapshot.beliefConfirmation.generatedDecisionNarrative,
    empiricalClaim: snapshot.beliefConfirmation.generatedEmpiricalClaim,
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

async function loginAsResearcher(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Tier 2 item 8 — review outcomes beyond 'deliver'", () => {
  test("outside_scope terminally refuses the session", async ({ page, request }) => {
    test.setTimeout(180_000);
    const sessionId = await driveToAssigned(request, "e2e-review-outside-scope");
    let testResearcherUserId: string | null = null;
    try {
      const { email, password, userId } = await createTestResearcher();
      testResearcherUserId = userId;
      await loginAsResearcher(page, email, password);

      const draft = await postJson(page.request, `/api/admin/sessions/${sessionId}/draft`, {});
      expect(draft.status).toBe(200);

      const approve = await postJson(page.request, `/api/admin/sessions/${sessionId}/approve`, {
        draftRevisionId: draft.body.draft.id,
        briefAccurate: true,
        evidenceRelation: "outside_scope",
        scopeJustification: "The pack's claims don't actually cover this participant's specific scenario.",
        contentHash: draft.body.draft.contentHash,
      });
      expect(approve.status).toBe(200);
      expect(approve.body.outcome).toBe("refused");

      const finalState = await page.request.get(`/api/admin/sessions/${sessionId}`);
      const finalBody = await finalState.json();
      expect(finalBody.session.state).toBe("refused");
      expect(finalBody.delivery).toBeNull();
    } finally {
      await cleanupSession(sessionId);
      if (testResearcherUserId) await deleteTestResearcher(testResearcherUserId);
    }
  });

  test("an inaccurate brief returns to 'assigned' (not a terminal refusal), then a fresh draft delivers", async ({ page, request }) => {
    // Discovery (one full loop) + two full draft/approve round trips; the
    // other test in this file only needs one approve call and comfortably
    // fits 180s, so this one gets more headroom rather than a blanket bump.
    test.setTimeout(300_000);
    const sessionId = await driveToAssigned(request, "e2e-review-inaccurate-brief");
    let testResearcherUserId: string | null = null;
    try {
      const { email, password, userId } = await createTestResearcher();
      testResearcherUserId = userId;
      await loginAsResearcher(page, email, password);

      const draft1 = await postJson(page.request, `/api/admin/sessions/${sessionId}/draft`, {});
      expect(draft1.status).toBe(200);

      const rejectBrief = await postJson(page.request, `/api/admin/sessions/${sessionId}/approve`, {
        draftRevisionId: draft1.body.draft.id,
        briefAccurate: false,
        evidenceRelation: "supports",
        scopeJustification: "The wording in this draft overstates the claim beyond what the source supports — needs a redraft.",
        contentHash: draft1.body.draft.contentHash,
      });
      expect(rejectBrief.status).toBe(200);
      expect(rejectBrief.body.outcome).toBe("needs_revision");

      const midState = await page.request.get(`/api/admin/sessions/${sessionId}`);
      const midBody = await midState.json();
      expect(midBody.session.state).toBe("assigned"); // actionable, not 'refused'
      expect(midBody.delivery).toBeNull();

      // "Generate draft" is available again — a fresh draft revision, not
      // an edit of the rejected one (append-only draft_revisions).
      const draft2 = await postJson(page.request, `/api/admin/sessions/${sessionId}/draft`, {});
      expect(draft2.status).toBe(200);
      expect(draft2.body.draft.id).not.toBe(draft1.body.draft.id);

      const approve2 = await postJson(page.request, `/api/admin/sessions/${sessionId}/approve`, {
        draftRevisionId: draft2.body.draft.id,
        briefAccurate: true,
        evidenceRelation: "supports",
        scopeJustification: "Redrafted wording now matches the source scope.",
        contentHash: draft2.body.draft.contentHash,
      });
      expect(approve2.status).toBe(200);
      expect(approve2.body.outcome).toBe("delivered");

      const finalState = await page.request.get(`/api/admin/sessions/${sessionId}`);
      const finalBody = await finalState.json();
      expect(finalBody.session.state).toBe("delivered");
      expect(finalBody.delivery.claimIds.length).toBeGreaterThan(0);
    } finally {
      await cleanupSession(sessionId);
      if (testResearcherUserId) await deleteTestResearcher(testResearcherUserId);
    }
  });
});
