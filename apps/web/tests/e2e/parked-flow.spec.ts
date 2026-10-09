import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

function signSessionCookie(sessionId: string): string {
  const secret = process.env.SESSION_TOKEN_SECRET!;
  const sig = createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

async function seedToConfirmed(supabase: SupabaseClient, packTopic: string | null, wording: string) {
  const { data: participant } = await supabase.from("participants").insert({ participant_code: `EF-PK${Date.now()}` }).select("id").single();
  const { data: session } = await supabase
    .from("sessions")
    .insert({ participant_id: participant!.id, state: "eligibility_check", pack_topic: packTopic, revision: 3 })
    .select("id")
    .single();
  const sessionId = session!.id;
  await supabase.from("belief_confirmations").insert({ session_id: sessionId, revision: 1, generated_wording: wording, confirmed_wording: wording, confirmed_at: new Date().toISOString() });
  return { sessionId, participantId: participant!.id };
}

async function cleanup(supabase: SupabaseClient, sessionId: string, participantId: string) {
  await supabase.from("eligibility_evaluations").delete().eq("session_id", sessionId);
  await supabase.from("belief_confirmations").delete().eq("session_id", sessionId);
  await supabase.from("sessions").delete().eq("id", sessionId);
  await supabase.from("participants").delete().eq("id", participantId);
}

test.describe("deterministic parking (no live model dependency)", () => {
  test("no actual consequence yet -> parked with a plain-language reason, no baseline/condition/claims", async ({ request }) => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { sessionId, participantId } = await seedToConfirmed(supabase, "activity", "I chose not to buy new running shoes instead of buying them because I expected they'd be too expensive.");
    try {
      const cookie = { Cookie: `ef_session=${signSessionCookie(sessionId)}` };
      const res = await request.post(`/api/sessions/${sessionId}/eligibility`, {
        headers: cookie,
        data: { stillHoldsBelief: true, scopeAndTime: "general", materiallyAffectedDecision: true, consequenceOccurred: false },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.disposition).toBe("parked");
      expect(body.gates.consequential.status).toBe("fail");

      const stateRes = await request.get(`/api/sessions/${sessionId}`, { headers: cookie });
      const state = await stateRes.json();
      expect(state.session.state).toBe("parked");
      expect(state.session.parkReason).toBeTruthy();
      expect(state.baseline).toBeNull();
      expect(state.assignment).toBeUndefined(); // participant DTO omits it entirely, not just null
      expect(state.delivery).toBeNull();
    } finally {
      await cleanup(supabase, sessionId, participantId);
    }
  });

  test("unsupported domain (no enabled pack for this topic) fails the checkable gate and cannot reach persuasion", async ({ request }) => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { sessionId, participantId } = await seedToConfirmed(supabase, null, "I chose the free Microsoft course instead of a paid course because I expected it to be just as good.");
    try {
      const cookie = { Cookie: `ef_session=${signSessionCookie(sessionId)}` };
      const res = await request.post(`/api/sessions/${sessionId}/eligibility`, {
        headers: cookie,
        data: {
          stillHoldsBelief: true,
          scopeAndTime: "course quality, this year",
          materiallyAffectedDecision: true,
          consequenceOccurred: true,
          consequenceEvidence: "spent 10 hours on the free course",
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.gates.checkable.status).toBe("fail");
      expect(body.disposition).toBe("parked");

      const stateRes = await request.get(`/api/sessions/${sessionId}`, { headers: cookie });
      const state = await stateRes.json();
      expect(state.session.state).toBe("parked");
      expect(state.assignment).toBeUndefined(); // participant DTO omits it entirely, not just null
      expect(state.delivery).toBeNull();
    } finally {
      await cleanup(supabase, sessionId, participantId);
    }
  });
});
