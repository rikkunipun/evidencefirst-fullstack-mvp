import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { confirmBeliefSchema } from "@/lib/zod/requests";
import { combineBeliefWording } from "@/lib/belief-wording";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = confirmBeliefSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "confirmation") return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });

  const { data: confirmation } = await supabase
    .from("belief_confirmations")
    .select("id, confirmed_at")
    .eq("session_id", id)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!confirmation) return NextResponse.json({ error: "server_error" }, { status: 500 });
  if (confirmation.confirmed_at) return NextResponse.json({ error: "invalid_state", details: "already confirmed" }, { status: 409 });

  // The combined sentence is always server-composed from the two
  // separately confirmed parts — never accepted as raw client text — so
  // confirmed_wording (read by every existing downstream consumer:
  // eligibility, baseline, crux, delivery, receipts, exports) keeps its
  // exact prior meaning and format.
  const { decisionNarrative, empiricalClaim } = parsed.data;
  const confirmedWording = combineBeliefWording(decisionNarrative, empiricalClaim);

  const { error: updateError } = await supabase
    .from("belief_confirmations")
    .update({
      confirmed_decision_narrative: decisionNarrative,
      confirmed_empirical_claim: empiricalClaim,
      confirmed_wording: confirmedWording,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", confirmation.id);
  if (updateError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const t = await transitionSession(supabase, id, "confirmation", session.revision, ["eligibility_check"]);
  if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });

  await recordAuditEvent({
    actorType: "participant",
    action: "belief_confirmed",
    entityType: "belief_confirmations",
    entityId: confirmation.id,
    after: { decisionNarrative, empiricalClaim, confirmedWording },
  });

  return NextResponse.json({ ok: true });
}
