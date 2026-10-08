import { test, expect, type APIRequestContext } from "@playwright/test";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

/**
 * Covers ack -> post-measurement -> follow-up -> receipt -> refresh/resume
 * by seeding a session directly to `delivered` via the DB (service role),
 * then driving the real participant-facing routes through a real signed
 * session cookie — no live model calls, so this is fast and deterministic.
 * The discovery->confirmation->eligibility->crux->assignment->researcher
 * path that leads to `delivered` is covered live by
 * eligible-activity-flow.spec.ts.
 */

function signSessionCookie(sessionId: string): string {
  const secret = process.env.SESSION_TOKEN_SECRET!;
  const sig = createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

async function postJson(request: APIRequestContext, url: string, body: unknown) {
  const res = await request.post(url, { data: body });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}

test("ack, post-measurement, follow-up, receipt, and refresh/resume all work from a seeded delivered session", async ({ page }) => {
  test.setTimeout(60_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: participant } = await supabase.from("participants").insert({ participant_code: "EF-E2ETEST" }).select("id").single();
  const { data: session } = await supabase
    .from("sessions")
    .insert({ participant_id: participant!.id, state: "delivered", pack_topic: "activity", revision: 10 })
    .select("id")
    .single();
  const sessionId = session!.id;
  const beliefWording = "I chose to skip the gym during a trip instead of going to the gym, because I expected to lose consistency.";

  await supabase.from("belief_confirmations").insert({ session_id: sessionId, revision: 1, generated_wording: beliefWording, confirmed_wording: beliefWording, confirmed_at: new Date().toISOString() });
  await supabase.from("baseline_snapshots").insert({ session_id: sessionId, belief_wording: beliefWording, scope_and_time: "general fitness", baseline_score: 9 });
  await supabase.from("measurements").insert({ session_id: sessionId, phase: "pre_evidence", score: 9 });
  const { data: block } = await supabase.from("assignment_blocks").select("id").limit(1).maybeSingle();
  await supabase.from("assignments").insert({ session_id: sessionId, pack_id: "activity", pack_version: "2.0", protocol_version: "order_personalization_v1", block_id: block?.id, block_position: 98, condition: "fixed" });
  const { data: draft } = await supabase
    .from("draft_revisions")
    .insert({
      session_id: sessionId,
      assignment_id: (await supabase.from("assignments").select("id").eq("session_id", sessionId).single()).data!.id,
      claim_order: ["C1", "C2", "C3", "C4", "C6"],
      rendered_text: "Exact delivered text for the test.",
      rendered_html: "<p>Exact delivered text for the test.</p>",
      word_count: 6,
      content_hash: "testhash",
      template_version: "delivery-template-v1",
    })
    .select("id")
    .single();
  const { data: approval } = await supabase
    .from("approvals")
    .insert({ draft_revision_id: draft!.id, reviewer_email: "test@example.com", disposition: "supported", scope_justification: "test", content_hash: "testhash" })
    .select("id")
    .single();
  await supabase.from("deliveries").insert({
    session_id: sessionId,
    approval_id: approval!.id,
    exact_text: "Exact delivered text for the test.",
    exact_html: "<p>Exact delivered text for the test.</p>",
    claim_ids: ["C1", "C2", "C3", "C4", "C6"],
    source_map: [{ claimId: "C1", sourceTitle: "WHO", url: "https://who.int" }],
    boundary_text: "boundary",
    template_version: "delivery-template-v1",
    content_hash: "testhash",
  });

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  await page.context().addCookies([{ name: "ef_session", value: signSessionCookie(sessionId), url: baseURL }]);

  try {
    // Resume: GET works with the real cookie before any action.
    const resumeBefore = await page.request.get(`/api/sessions/${sessionId}`);
    expect(resumeBefore.status()).toBe(200);
    const before = await resumeBefore.json();
    expect(before.session.state).toBe("delivered");
    expect(before.delivery.exactText).toBe("Exact delivered text for the test.");

    // post-score cannot be submitted before ack.
    const earlyMeasure = await postJson(page.request, `/api/sessions/${sessionId}/measurements`, { score: 6 });
    expect(earlyMeasure.status).toBe(409);

    // Ack.
    const ack = await postJson(page.request, `/api/sessions/${sessionId}/ack`, {});
    expect(ack.status).toBe(200);

    // Refresh/resume mid-flow reproduces the new state exactly.
    const resumeAfterAck = await page.request.get(`/api/sessions/${sessionId}`);
    const afterAck = await resumeAfterAck.json();
    expect(afterAck.session.state).toBe("ack_recorded");

    // Retrying ack after the state has already advanced correctly rejects rather than re-processing.
    const ackAgain = await postJson(page.request, `/api/sessions/${sessionId}/ack`, {});
    expect(ackAgain.status).toBe(409);

    // Post-evidence measurement creates the follow-up.
    const post = await postJson(page.request, `/api/sessions/${sessionId}/measurements`, { score: 6, explanation: "x", reportedBehavior: "y" });
    expect(post.status).toBe(200);
    const followupToken = post.body.followupUrl.split("/follow-up/")[1];

    // Follow-up correctly reports "not yet due".
    const followupGet = await page.request.get(`/api/follow-up/${followupToken}`);
    const followupBody = await followupGet.json();
    expect(followupBody.isDue).toBe(false);
    expect(followupBody.beliefWording).toBe(beliefWording);

    const earlySubmit = await postJson(page.request, `/api/follow-up/${followupToken}`, { score: 5, reportedBehavior: "test" });
    expect(earlySubmit.status).toBe(409);

    // Receipt reflects exact frozen values.
    const receiptRes = await page.request.get(`/api/sessions/${sessionId}/receipt`);
    const receipt = await receiptRes.json();
    expect(receipt.frozenBelief).toBe(beliefWording);
    expect(receipt.scores).toEqual({ baseline: 9, preEvidence: 9, postEvidence: 6 });

    // Final resume: state and delivered text are byte-identical to before.
    const finalResume = await page.request.get(`/api/sessions/${sessionId}`);
    const finalBody = await finalResume.json();
    expect(finalBody.session.state).toBe("followup_due");
    expect(finalBody.delivery.exactText).toBe(before.delivery.exactText);
  } finally {
    const tables = ["followups", "deliveries", "measurements", "baseline_snapshots", "belief_confirmations"];
    for (const t of tables) await supabase.from(t).delete().eq("session_id", sessionId);
    await supabase.from("approvals").delete().eq("draft_revision_id", draft!.id);
    await supabase.from("draft_revisions").delete().eq("session_id", sessionId);
    await supabase.from("assignments").delete().eq("session_id", sessionId);
    await supabase.from("sessions").delete().eq("id", sessionId);
    await supabase.from("participants").delete().eq("id", participant!.id);
  }
});

test("unauthenticated access to a seeded session is rejected (ID alone is never enough)", async ({ request }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: participant } = await supabase.from("participants").insert({ participant_code: "EF-E2ETEST2" }).select("id").single();
  const { data: session } = await supabase.from("sessions").insert({ participant_id: participant!.id, state: "delivered" }).select("id").single();
  try {
    const res = await request.get(`/api/sessions/${session!.id}`);
    expect(res.status()).toBe(404);
  } finally {
    await supabase.from("sessions").delete().eq("id", session!.id);
    await supabase.from("participants").delete().eq("id", participant!.id);
  }
});
