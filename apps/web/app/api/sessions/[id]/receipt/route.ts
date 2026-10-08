import { NextResponse } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("id, state, participant_id, created_at, park_reason").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [{ data: participant }, { data: baseline }, { data: measurements }, { data: delivery }, { data: followup }, { data: confirmation }] = await Promise.all([
    supabase.from("participants").select("participant_code").eq("id", session.participant_id).single(),
    supabase.from("baseline_snapshots").select("baseline_score, frozen_at").eq("session_id", id).maybeSingle(),
    supabase.from("measurements").select("phase, score, recorded_at").eq("session_id", id),
    supabase.from("deliveries").select("exact_text, source_map, delivered_at").eq("session_id", id).maybeSingle(),
    supabase.from("followups").select("due_at, collected_at, score").eq("session_id", id).maybeSingle(),
    supabase.from("belief_confirmations").select("confirmed_wording").eq("session_id", id).order("revision", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const scoresByPhase: Record<string, number> = {};
  for (const m of measurements ?? []) scoresByPhase[m.phase] = m.score;

  return NextResponse.json({
    participantCode: participant?.participant_code ?? null,
    sessionState: session.state,
    frozenBelief: confirmation?.confirmed_wording ?? null,
    parkReason: session.park_reason,
    scores: { baseline: baseline?.baseline_score ?? null, preEvidence: scoresByPhase.pre_evidence ?? null, postEvidence: scoresByPhase.post_evidence ?? null },
    sourcesShown: delivery?.source_map ?? null,
    deliveredText: delivery?.exact_text ?? null,
    deliveredAt: delivery?.delivered_at ?? null,
    followup: followup ? { dueAt: followup.due_at, collected: Boolean(followup.collected_at), score: followup.score } : null,
    generatedAt: new Date().toISOString(),
  });
}
