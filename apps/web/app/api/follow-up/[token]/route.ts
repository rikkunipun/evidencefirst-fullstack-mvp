import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { hashToken } from "@/lib/capability";
import { isFollowupDue } from "@/lib/followup";
import { followupSubmitSchema } from "@/lib/zod/requests";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";

async function loadFollowup(token: string) {
  const supabase = getServiceClient();
  const { data: followup } = await supabase
    .from("followups")
    .select("id, session_id, due_at, collected_at, score")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  return { supabase, followup };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { followup } = await loadFollowup(token);
  if (!followup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { supabase } = await loadFollowup(token);
  const { data: confirmation } = await supabase
    .from("belief_confirmations")
    .select("confirmed_wording")
    .eq("session_id", followup.session_id)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();

  const due = isFollowupDue(new Date(followup.due_at));
  return NextResponse.json({
    beliefWording: confirmation?.confirmed_wording ?? null,
    dueAt: followup.due_at,
    isDue: due,
    alreadyCollected: Boolean(followup.collected_at),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { supabase, followup } = await loadFollowup(token);
  if (!followup) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (followup.collected_at) return NextResponse.json({ error: "invalid_state", details: "already collected" }, { status: 409 });
  if (!isFollowupDue(new Date(followup.due_at))) {
    return NextResponse.json({ error: "invalid_state", details: "not yet due" }, { status: 409 });
  }

  const json = await req.json().catch(() => null);
  const parsed = followupSubmitSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

  const { error: updateError } = await supabase
    .from("followups")
    .update({ collected_at: new Date().toISOString(), score: parsed.data.score, reported_behavior: parsed.data.reportedBehavior, other_influences: parsed.data.otherInfluences ?? null })
    .eq("id", followup.id);
  if (updateError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const { data: session } = await supabase.from("sessions").select("state, revision").eq("id", followup.session_id).maybeSingle();
  if (session && (session.state === "followup_due" || session.state === "measured")) {
    await transitionSession(supabase, followup.session_id, session.state === "measured" ? "measured" : "followup_due", session.revision, session.state === "measured" ? ["followup_due", "complete"] : ["complete"]);
  }

  await recordAuditEvent({ actorType: "participant", action: "followup_collected", entityType: "followups", entityId: followup.id, after: { score: parsed.data.score } });

  return NextResponse.json({ ok: true });
}
