import { NextResponse, type NextRequest } from "next/server";
import { requireResearcherOrResponse } from "@/lib/require-researcher-api";
import { getServiceClient } from "@/lib/supabase/service-client";

interface ExportRow {
  participantCode: string;
  sessionId: string;
  isTest: boolean;
  state: string;
  parkReason: string | null;
  packId: string | null;
  condition: string | null;
  baselineScore: number | null;
  preEvidenceScore: number | null;
  postEvidenceScore: number | null;
  followupScore: number | null;
  claimIds: string[] | null;
  deliveredAt: string | null;
  /** Item 8/10: describe automation honestly, never a blanket claim either way. */
  deliveryModeAtCreation: string | null;
  reviewType: "automatic" | "researcher" | null;
  reviewDescription: string | null;
  policyVersion: string | null;
  packVersion: string | null;
  templateVersion: string | null;
  claimKind: string | null;
}

/** Sanitizes a cell so it can't break CSV structure or be interpreted as a spreadsheet formula. */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // formula-injection guard
  if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const researcher = await requireResearcherOrResponse();
  if (researcher instanceof NextResponse) return researcher;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  // Exports default to real consented data only. Synthetic QA/audit
  // fixtures (is_test=true) are excluded unless explicitly requested -
  // they are never deleted, just never the default export.
  const includeTest = url.searchParams.get("includeTest") === "true";
  const supabase = getServiceClient();

  let query = supabase
    .from("sessions")
    .select("id, state, park_reason, pack_topic, participant_id, is_test, delivery_mode, claim_kind")
    .not("state", "in", '("consented","context","discovery","confirmation","eligibility_check")');
  if (!includeTest) query = query.eq("is_test", false);
  const { data: sessions } = await query;
  if (!sessions) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const rows: ExportRow[] = [];
  for (const s of sessions) {
    const [{ data: participant }, { data: assignment }, { data: baseline }, { data: measurements }, { data: followup }, { data: delivery }] = await Promise.all([
      supabase.from("participants").select("participant_code").eq("id", s.participant_id).single(),
      supabase.from("assignments").select("condition, pack_id").eq("session_id", s.id).maybeSingle(),
      supabase.from("baseline_snapshots").select("baseline_score").eq("session_id", s.id).maybeSingle(),
      supabase.from("measurements").select("phase, score").eq("session_id", s.id),
      supabase.from("followups").select("score").eq("session_id", s.id).maybeSingle(),
      supabase.from("deliveries").select("claim_ids, delivered_at, approval_id").eq("session_id", s.id).maybeSingle(),
    ]);
    const scoresByPhase: Record<string, number> = {};
    for (const m of measurements ?? []) scoresByPhase[m.phase] = m.score;

    let reviewType: "automatic" | "researcher" | null = null;
    let reviewDescription: string | null = null;
    let policyVersion: string | null = null;
    let packVersion: string | null = null;
    let templateVersion: string | null = null;
    if (delivery?.approval_id) {
      const { data: approval } = await supabase
        .from("approvals")
        .select("is_system, policy_version, pack_version, template_version")
        .eq("id", delivery.approval_id)
        .maybeSingle();
      if (approval?.is_system) {
        reviewType = "automatic";
        reviewDescription = "system validation";
        policyVersion = approval.policy_version;
        packVersion = approval.pack_version;
        templateVersion = approval.template_version;
      } else if (approval) {
        reviewType = "researcher";
        reviewDescription = "researcher review";
      }
    }

    rows.push({
      participantCode: participant?.participant_code ?? "unknown",
      sessionId: s.id,
      isTest: s.is_test,
      state: s.state,
      parkReason: s.park_reason,
      packId: assignment?.pack_id ?? s.pack_topic,
      condition: assignment?.condition ?? null,
      baselineScore: baseline?.baseline_score ?? null,
      preEvidenceScore: scoresByPhase.pre_evidence ?? null,
      postEvidenceScore: scoresByPhase.post_evidence ?? null,
      followupScore: followup?.score ?? null,
      claimIds: delivery?.claim_ids ?? null,
      deliveredAt: delivery?.delivered_at ?? null,
      deliveryModeAtCreation: s.delivery_mode ?? null,
      reviewType,
      reviewDescription,
      policyVersion,
      packVersion,
      templateVersion,
      claimKind: s.claim_kind ?? null,
    });
  }

  if (format === "json") {
    return NextResponse.json({ exportedAt: new Date().toISOString(), includeTest, rowCount: rows.length, rows });
  }

  const headers = Object.keys(
    rows[0] ?? {
      participantCode: "",
      sessionId: "",
      isTest: "",
      state: "",
      parkReason: "",
      packId: "",
      condition: "",
      baselineScore: "",
      preEvidenceScore: "",
      postEvidenceScore: "",
      followupScore: "",
      claimIds: "",
      deliveredAt: "",
      deliveryModeAtCreation: "",
      reviewType: "",
      reviewDescription: "",
      policyVersion: "",
      packVersion: "",
      templateVersion: "",
      claimKind: "",
    },
  );
  const csvLines = [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell((r as unknown as Record<string, unknown>)[h])).join(","))];
  return new NextResponse(csvLines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="evidencefirst-export-${Date.now()}.csv"` },
  });
}
