import { NextResponse, type NextRequest } from "next/server";
import { requireResearcherOrResponse } from "@/lib/require-researcher-api";
import { getServiceClient } from "@/lib/supabase/service-client";
import { adminMarkTestSchema } from "@/lib/zod/requests";
import { recordAuditEvent } from "@/lib/audit";

/**
 * General, researcher-authorized path for marking known sessions as
 * synthetic/QA test data. Exact session IDs only — no label or text
 * matching, no deletion. Idempotent: a session already marked with the
 * given test_run_id is reported as already-marked and not re-audited.
 * This exists so a pilot label is never the only separation mechanism
 * between test fixtures and real participant data in exports.
 */
export async function POST(req: NextRequest) {
  const researcher = await requireResearcherOrResponse();
  if (researcher instanceof NextResponse) return researcher;

  const json = await req.json().catch(() => null);
  const parsed = adminMarkTestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  const { sessionIds, testRunId, reason } = parsed.data;

  const supabase = getServiceClient();
  const results: { id: string; outcome: "marked" | "already_marked" | "not_found" | "error" }[] = [];

  for (const id of sessionIds) {
    const { data: session, error: readError } = await supabase.from("sessions").select("id, is_test, test_run_id").eq("id", id).maybeSingle();
    if (readError) {
      results.push({ id, outcome: "error" });
      continue;
    }
    if (!session) {
      results.push({ id, outcome: "not_found" });
      continue;
    }
    if (session.is_test && session.test_run_id === testRunId) {
      results.push({ id, outcome: "already_marked" });
      continue;
    }
    const before = { is_test: session.is_test, test_run_id: session.test_run_id };
    const { error: updateError } = await supabase.from("sessions").update({ is_test: true, test_run_id: testRunId }).eq("id", id);
    if (updateError) {
      results.push({ id, outcome: "error" });
      continue;
    }
    await recordAuditEvent({
      actorType: "researcher",
      action: "marked_is_test",
      entityType: "sessions",
      entityId: id,
      before,
      after: { is_test: true, test_run_id: testRunId, reason },
    });
    results.push({ id, outcome: "marked" });
  }

  return NextResponse.json({ testRunId, results });
}
