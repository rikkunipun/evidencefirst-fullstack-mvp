import { NextResponse, type NextRequest } from "next/server";
import { requireResearcherOrResponse } from "@/lib/require-researcher-api";
import { getServiceClient } from "@/lib/supabase/service-client";

interface ExportRow {
  participantCode: string;
  sessionId: string;
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

  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const supabase = getServiceClient();

  const { data: sessions } = await supabase.from("sessions").select("id, state, park_reason, pack_topic, participant_id").not("state", "in", '("consented","context","discovery","confirmation","eligibility_check")');
  if (!sessions) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const rows: ExportRow[] = [];
  for (const s of sessions) {
    const [{ data: participant }, { data: assignment }, { data: baseline }, { data: measurements }, { data: followup }, { data: delivery }] = await Promise.all([
      supabase.from("participants").select("participant_code").eq("id", s.participant_id).single(),
      supabase.from("assignments").select("condition, pack_id").eq("session_id", s.id).maybeSingle(),
      supabase.from("baseline_snapshots").select("baseline_score").eq("session_id", s.id).maybeSingle(),
      supabase.from("measurements").select("phase, score").eq("session_id", s.id),
      supabase.from("followups").select("score").eq("session_id", s.id).maybeSingle(),
      supabase.from("deliveries").select("claim_ids, delivered_at").eq("session_id", s.id).maybeSingle(),
    ]);
    const scoresByPhase: Record<string, number> = {};
    for (const m of measurements ?? []) scoresByPhase[m.phase] = m.score;

    rows.push({
      participantCode: participant?.participant_code ?? "unknown",
      sessionId: s.id,
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
    });
  }

  if (format === "json") {
    return NextResponse.json({ exportedAt: new Date().toISOString(), rowCount: rows.length, rows });
  }

  const headers = Object.keys(rows[0] ?? { participantCode: "", sessionId: "", state: "", parkReason: "", packId: "", condition: "", baselineScore: "", preEvidenceScore: "", postEvidenceScore: "", followupScore: "", claimIds: "", deliveredAt: "" });
  const csvLines = [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell((r as unknown as Record<string, unknown>)[h])).join(","))];
  return new NextResponse(csvLines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="evidencefirst-export-${Date.now()}.csv"` },
  });
}
