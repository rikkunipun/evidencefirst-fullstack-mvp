import { NextResponse, type NextRequest } from "next/server";
import { requireResearcherOrResponse } from "@/lib/require-researcher-api";
import { getServiceClient } from "@/lib/supabase/service-client";
import { getEnv } from "@/lib/env";
import { EVIDENCE_PACKS, selectClaims } from "@/lib/evidence";
import { composeDelivery, DELIVERY_TEMPLATE_VERSION } from "@/lib/delivery-template";
import { computeContentHash } from "@/lib/content-hash";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const researcher = await requireResearcherOrResponse();
  if (researcher instanceof NextResponse) return researcher;
  const { id } = await params;

  // Item 10: admin is inspection/export/post-hoc flagging only in auto
  // mode — no manual draft/approve action, not even as a side door.
  if (getEnv().DELIVERY_MODE !== "manual") {
    return NextResponse.json({ error: "invalid_state", details: "manual draft generation is disabled while DELIVERY_MODE=auto" }, { status: 409 });
  }

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "assigned") return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });

  const { data: assignment } = await supabase.from("assignments").select("id, condition, pack_id, pack_version").eq("session_id", id).maybeSingle();
  if (!assignment) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const { data: confirmation } = await supabase
    .from("belief_confirmations")
    .select("confirmed_wording")
    .eq("session_id", id)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: cruxPasses } = await supabase.from("crux_passes").select("confirmed_reason, hypothetical_score").eq("session_id", id);
  const { data: baseline } = await supabase.from("baseline_snapshots").select("baseline_score").eq("session_id", id).maybeSingle();
  const confirmedReason = cruxPasses?.find((p) => p.confirmed_reason && p.hypothetical_score !== null && baseline && p.hypothetical_score < baseline.baseline_score)?.confirmed_reason;
  if (!confirmation?.confirmed_wording || !confirmedReason) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const pack = EVIDENCE_PACKS[assignment.pack_id];
  if (!pack) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const orderedClaims = selectClaims(pack, assignment.condition, confirmedReason);
  const content = composeDelivery(pack, orderedClaims, confirmedReason);
  const claimOrder = orderedClaims.map((c) => c.id);
  const contentHash = computeContentHash(content.text, claimOrder, DELIVERY_TEMPLATE_VERSION);

  const { data: draft, error: draftError } = await supabase
    .from("draft_revisions")
    .insert({
      session_id: id,
      assignment_id: assignment.id,
      claim_order: claimOrder,
      rendered_text: content.text,
      rendered_html: content.html,
      word_count: content.wordCount,
      content_hash: contentHash,
      template_version: DELIVERY_TEMPLATE_VERSION,
    })
    .select("id, claim_order, rendered_text, rendered_html, word_count, content_hash")
    .single();
  if (draftError || !draft) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const t = await transitionSession(supabase, id, "assigned", session.revision, ["pending_review"]);
  if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });

  await recordAuditEvent({ actorType: "researcher", actorId: researcher.email, action: "draft_generated", entityType: "draft_revisions", entityId: draft.id });

  return NextResponse.json({
    draft: {
      id: draft.id,
      claimOrder: draft.claim_order,
      renderedText: draft.rendered_text,
      renderedHtml: draft.rendered_html,
      wordCount: draft.word_count,
      contentHash: draft.content_hash,
    },
    sourceMap: orderedClaims.map((c) => ({ claimId: c.id, text: c.text, sourceTitle: c.sourceTitle, url: c.url })),
  });
}
