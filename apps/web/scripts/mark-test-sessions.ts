/**
 * Idempotent, audited is_test marking for a known, fixed list of session
 * IDs — never a loose text/label match, never a delete.
 *
 * Usage:
 *   npx tsx scripts/mark-test-sessions.ts            # dry run (default) — reads and reports only
 *   npx tsx scripts/mark-test-sessions.ts --apply    # writes is_test=true + test_run_id, with an audit event per row
 *
 * Safety:
 * - Only touches the exact UUIDs listed below (from
 *   EvidenceFirst_Updated_Feedback_Oct9.md / …Retest_Oct9.json). No WHERE
 *   clause on label/text/pilot — a session not in this exact list is
 *   never touched, by construction.
 * - Idempotent: re-running (dry or --apply) is always safe. A row already
 *   marked with this exact test_run_id is reported as "already marked"
 *   and not re-written or re-audited.
 * - No deletion, ever.
 * - --apply must only be run after the operator has reviewed the dry-run
 *   output below and the row's content genuinely matches its expected
 *   case description — this script does not infer that automatically.
 */
import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";

const TEST_RUN_ID = "synthetic-retest-2026-10-09";

const TARGETS: { id: string; expectedCase: string }[] = [
  { id: "7080b559-1494-4953-bb33-7d62f174118c", expectedCase: "Mixed preference + explicit causal factual study expectation, card plus typed opening story" },
  { id: "8791d1f8-8cd8-4fe5-aef5-0f6f868c56b3", expectedCase: "Pure factual adult-activity expectation, card plus typed opening story" },
  { id: "1bc2bbdc-b47d-4dfa-b5e7-e29f087cadb2", expectedCase: "Same mixed study story after a card-only opening question, neutral goal" },
  { id: "649cb91a-8e35-450e-83f5-783e75772f31", expectedCase: "Genuine diagram preference; no factual superiority claim or past cost" },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Mode: ${apply ? "APPLY (will write)" : "DRY RUN (read-only)"}`);
  console.log(`test_run_id: ${TEST_RUN_ID}\n`);

  for (const target of TARGETS) {
    const { data: session, error } = await supabase
      .from("sessions")
      .select("id, state, pack_topic, pilot_label, is_test, test_run_id, created_at")
      .eq("id", target.id)
      .maybeSingle();

    if (error) {
      console.log(`[${target.id}] ERROR reading row: ${error.message}`);
      continue;
    }
    if (!session) {
      console.log(`[${target.id}] NOT FOUND — skipping. Expected case: "${target.expectedCase}"`);
      continue;
    }

    const { data: firstMessage } = await supabase
      .from("messages")
      .select("content")
      .eq("session_id", target.id)
      .eq("role", "participant")
      .order("turn_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    console.log(`[${target.id}]`);
    console.log(`  expected case: ${target.expectedCase}`);
    console.log(`  state=${session.state} pack_topic=${session.pack_topic} pilot_label=${session.pilot_label} created_at=${session.created_at}`);
    console.log(`  is_test=${session.is_test} test_run_id=${session.test_run_id}`);
    console.log(`  first participant message (for manual label check): ${(firstMessage?.content ?? "(none)").slice(0, 160)}`);

    if (session.is_test && session.test_run_id === TEST_RUN_ID) {
      console.log(`  -> already marked with this test_run_id. No-op.\n`);
      continue;
    }

    if (!apply) {
      console.log(`  -> dry run: would set is_test=true, test_run_id=${TEST_RUN_ID}\n`);
      continue;
    }

    const before = { is_test: session.is_test, test_run_id: session.test_run_id };
    const { error: updateError } = await supabase.from("sessions").update({ is_test: true, test_run_id: TEST_RUN_ID }).eq("id", target.id);
    if (updateError) {
      console.log(`  -> UPDATE FAILED: ${updateError.message}\n`);
      continue;
    }
    const after = { is_test: true, test_run_id: TEST_RUN_ID };
    const { error: auditError } = await supabase.from("audit_events").insert({
      actor_type: "researcher",
      action: "marked_is_test",
      entity_type: "sessions",
      entity_id: target.id,
      before,
      after,
    });
    if (auditError) console.log(`  -> WARNING: audit event insert failed: ${auditError.message}`);
    console.log(`  -> marked is_test=true, test_run_id=${TEST_RUN_ID} (audited)\n`);
  }
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
