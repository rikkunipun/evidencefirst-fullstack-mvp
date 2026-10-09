/**
 * ONE-OFF labelled integration check (dev server + live DB + live model):
 * confirms the Tier 2 item 9 topic-proposal flow end-to-end for a genuine
 * free-text-only session (no situation card -> pack_topic starts null).
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
  const { data: participant } = await supabase.from("participants").insert({ participant_code: `EF-TP${Date.now()}` }).select("id").single();
  const { data: session } = await supabase
    .from("sessions")
    .insert({ participant_id: participant!.id, state: "context", revision: 1, pack_topic: null })
    .select("id")
    .single();
  const sessionId = session!.id;
  await supabase.from("context_answers").insert({
    session_id: sessionId,
    situation_card: "other",
    goal: null,
    decision_cue: null, // no card -> free-text-only path
    free_text:
      "Last Monday I chose the bus to a gym instead of brisk walking outside because I expected brisk walking cannot count as moderate-intensity aerobic activity in adult recommendations. I still hold that expectation. My dated tickets record 150 rupees in extra fares.",
  });
  const cookie = { Cookie: `ef_session=${signSessionCookie(sessionId)}`, "Content-Type": "application/json" };

  try {
    let content: string | null = null;
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${BASE}/api/sessions/${sessionId}/messages`, { method: "POST", headers: cookie, body: JSON.stringify({ content, inputMode: "text", clientToken: crypto.randomUUID() }) });
      const body = await res.json();
      console.log(`turn ${i + 1}: status=${res.status} body=${JSON.stringify(body)}`);
      if (body.assistantQuestion && body.assistantQuestion.includes("mainly about")) {
        content = "Yes, that's right."; // answer the topic-confirmation question
      } else if (body.done) {
        break;
      } else {
        content = "That's the full picture.";
      }
    }

    const { data: finalSession } = await supabase.from("sessions").select("pack_topic, state").eq("id", sessionId).maybeSingle();
    console.log("final session row:", finalSession);
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
