import { NextResponse, type NextRequest } from "next/server";
import { requireResearcherOrResponse } from "@/lib/require-researcher-api";
import { getServiceClient } from "@/lib/supabase/service-client";
import { adminReversalSchema } from "@/lib/zod/requests";
import { EVIDENCE_PACKS, exactSupport } from "@/lib/evidence";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const researcher = await requireResearcherOrResponse();
  if (researcher instanceof NextResponse) return researcher;

  const json = await req.json().catch(() => null);
  const parsed = adminReversalSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const packsToSearch = body.packId ? [body.packId] : Object.keys(EVIDENCE_PACKS);
  let matchedClaimIds: string[] = [];
  let matchedPackId: string | null = null;
  for (const packId of packsToSearch) {
    const matches = exactSupport(packId, body.submittedClaim);
    if (matches.length > 0) {
      matchedClaimIds = matches;
      matchedPackId = packId;
      break;
    }
  }
  const supported = matchedClaimIds.length > 0;

  const supabase = getServiceClient();
  const { data: run, error } = await supabase
    .from("reversal_runs")
    .insert({
      reviewer_email: researcher.email,
      pack_id: matchedPackId ?? body.packId ?? null,
      submitted_claim: body.submittedClaim,
      supported,
      matched_claim_ids: matchedClaimIds,
      // A reversal run is always a researcher QA probe, never real
      // participant data - mark it as test by construction.
      is_test: true,
      test_run_id: "reversal-qa",
    })
    .select("id, created_at")
    .single();
  if (error || !run) return NextResponse.json({ error: "server_error" }, { status: 500 });

  await recordAuditEvent({ actorType: "researcher", actorId: researcher.email, action: "reversal_run", entityType: "reversal_runs", entityId: run.id, after: { supported, matchedClaimIds } });

  return NextResponse.json({
    runId: run.id,
    createdAt: run.created_at,
    supported,
    matchedClaimIds,
    refusalReceipt: supported
      ? null
      : {
          message: "No enabled evidence unit exactly supports this assertion. No persuasive factual brief can be produced for it.",
          deliveredFactualClaims: 0,
        },
  });
}
