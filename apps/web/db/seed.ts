/**
 * Dev-only seed: loads the 3 audited evidence packs into `evidence_units`.
 * Idempotent (upsert on the pack_id/pack_version/claim_id unique key) so it
 * can be re-run safely. Does NOT seed fake sessions/participants/receipts —
 * those must come from real consented use or explicitly-labelled QA fixtures.
 */
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { EVIDENCE_PACKS } from "../lib/evidence";

// Not reusing lib/supabase/service-client.ts here: it imports "server-only",
// which unconditionally throws outside Next's bundler (this script runs via
// plain tsx/node). Build an equivalent client directly instead.
function getScriptServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function main() {
  const supabase = getScriptServiceClient();
  let count = 0;
  for (const pack of Object.values(EVIDENCE_PACKS)) {
    for (const claim of pack.claims) {
      const { error } = await supabase
        .from("evidence_units")
        .upsert(
          {
            pack_id: pack.id,
            pack_version: pack.version,
            claim_id: claim.id,
            claim_text: claim.text,
            source_id: claim.sourceId,
            source_title: claim.sourceTitle,
            source_url: claim.url,
            locator: claim.locator,
            evidence_note: claim.evidenceNote,
            tags: claim.tags,
            audit_status: claim.auditStatus,
            audit_date: claim.auditDate,
            enabled: pack.enabled,
            scope: pack.scope,
            boundary: pack.boundary,
          },
          { onConflict: "pack_id,pack_version,claim_id" },
        );
      if (error) throw new Error(`Seed failed for ${pack.id}/${claim.id}: ${error.message}`);
      count++;
    }
  }
  console.log(`Seeded ${count} evidence units across ${Object.keys(EVIDENCE_PACKS).length} packs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
