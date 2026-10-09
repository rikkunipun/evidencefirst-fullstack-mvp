/**
 * ONE-OFF INTEGRATION CHECK against a locally running `npm run dev`
 * (localhost:3000) and the real configured Supabase + live model. Seeds
 * its own throwaway session/participant and cleans them up. Not part of
 * CI. Verifies the full repaired path end-to-end (route + DB columns +
 * live model), not just the pure-function unit tests.
 *
 *   npm run dev &
 *   npx tsx scripts/integration-check.ts
 */
import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const BASE = "http://localhost:3000";

function signSessionCookie(sessionId: string): string {
  const secret = process.env.SESSION_TOKEN_SECRET!;
  const sig = createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: participant } = await supabase.from("participants").insert({ participant_code: `EF-IC${Date.now()}` }).select("id").single();
  const { data: session } = await supabase
    .from("sessions")
    .insert({ participant_id: participant!.id, state: "context", revision: 1, pack_topic: "activity" })
    .select("id")
    .single();
  const sessionId = session!.id;
  await supabase.from("context_answers").insert({
    session_id: sessionId,
    situation_card: "other",
    goal: null,
    decision_cue: null,
    free_text:
      "Last Monday I chose the bus to a gym instead of brisk walking outside because I expected brisk walking cannot count as moderate-intensity aerobic activity in adult recommendations. I still hold that expectation. My dated tickets record 150 rupees in extra fares.",
  });

  const cookie = { Cookie: `ef_session=${signSessionCookie(sessionId)}`, "Content-Type": "application/json" };

  try {
    console.log(`Seeded session ${sessionId}. Kicking off discovery via the real route...`);
    const res1 = await fetch(`${BASE}/api/sessions/${sessionId}/messages`, { method: "POST", headers: cookie, body: JSON.stringify({ content: null, inputMode: "text" }) });
    const body1 = await res1.json();
    console.log("turn 1 status:", res1.status, "body:", JSON.stringify(body1));

    const { data: sessionRow } = await supabase
      .from("sessions")
      .select("state, discovery_repair_used, discovery_recovery_reason, needs_researcher_review")
      .eq("id", sessionId)
      .maybeSingle();
    console.log("session row after turn 1:", sessionRow);

    const { data: snapshot } = await supabase.from("extraction_snapshots").select("fields, field_evidence, should_stop, stop_reason, validation_diagnostics").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1);
    console.log("latest extraction_snapshot:", JSON.stringify(snapshot?.[0], null, 2));

    // Duplicate-token check: resend the exact same kickoff request with no
    // token (content===null path uses the "resync" branch regardless of
    // messages.length) — already covered elsewhere; here just confirm the
    // server doesn't error on a second identical call.
    const res2 = await fetch(`${BASE}/api/sessions/${sessionId}/messages`, { method: "POST", headers: cookie, body: JSON.stringify({ content: null, inputMode: "text" }) });
    console.log("duplicate kickoff status:", res2.status, "body:", JSON.stringify(await res2.json()));
  } finally {
    await supabase.from("extraction_snapshots").delete().eq("session_id", sessionId);
    await supabase.from("belief_confirmations").delete().eq("session_id", sessionId);
    await supabase.from("messages").delete().eq("session_id", sessionId);
    await supabase.from("context_answers").delete().eq("session_id", sessionId);
    await supabase.from("audit_events").delete().eq("entity_id", sessionId);
    await supabase.from("sessions").delete().eq("id", sessionId);
    await supabase.from("participants").delete().eq("id", participant!.id);
    console.log("cleaned up.");
  }
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
