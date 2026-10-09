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
    supabase.from("deliveries").select("exact_text, source_map, delivered_at, approval_id").eq("session_id", id).maybeSingle(),
    supabase.from("followups").select("due_at, collected_at, score").eq("session_id", id).maybeSingle(),
    supabase.from("belief_confirmations").select("confirmed_wording").eq("session_id", id).order("revision", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const scoresByPhase: Record<string, number> = {};
  for (const m of measurements ?? []) scoresByPhase[m.phase] = m.score;

  // Item 8/6: describe automation honestly — whichever path actually
  // produced this delivery, never a blanket claim either way, and never
  // naming a human reviewer for an automatic decision.
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

  return NextResponse.json({
    participantCode: participant?.participant_code ?? null,
    sessionState: session.state,
    frozenBelief: confirmation?.confirmed_wording ?? null,
    parkReason: session.park_reason,
    scores: { baseline: baseline?.baseline_score ?? null, preEvidence: scoresByPhase.pre_evidence ?? null, postEvidence: scoresByPhase.post_evidence ?? null },
    sourcesShown: delivery?.source_map ?? null,
    deliveredText: delivery?.exact_text ?? null,
    deliveredAt: delivery?.delivered_at ?? null,
    reviewType,
    reviewDescription,
    policyVersion,
    packVersion,
    templateVersion,
    followup: followup ? { dueAt: followup.due_at, collected: Boolean(followup.collected_at), score: followup.score } : null,
    generatedAt: new Date().toISOString(),
  });
}
