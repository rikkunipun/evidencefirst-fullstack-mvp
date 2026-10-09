import { NextResponse, type NextRequest } from "next/server";
import { requireResearcherOrResponse } from "@/lib/require-researcher-api";
import { getServiceClient } from "@/lib/supabase/service-client";
import { adminApproveSchema } from "@/lib/zod/requests";
import { EVIDENCE_PACKS } from "@/lib/evidence";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";

// Maps the new, explicit two-question review onto the legacy disposition
// column for anything still reading it (admin display, exports) — never
// used for routing logic below, which reads briefAccurate/evidenceRelation
// directly. 'contradicts' and 'outside_scope' are new values the expanded
// check constraint (migration 0016) now allows.
function legacyDisposition(briefAccurate: boolean, evidenceRelation: string): string {
  if (!briefAccurate) return "needs_clarification";
  if (evidenceRelation === "unresolved") return "needs_clarification";
  if (evidenceRelation === "outside_scope") return "outside_scope";
  return evidenceRelation; // supports|qualifies|contradicts
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const researcher = await requireResearcherOrResponse();
  if (researcher instanceof NextResponse) return researcher;
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = adminApproveSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "pending_review") return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });

  const { data: draft } = await supabase
    .from("draft_revisions")
    .select("id, claim_order, rendered_text, rendered_html, content_hash, template_version")
    .eq("session_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draft || draft.id !== body.draftRevisionId) {
    return NextResponse.json({ error: "invalid_request", details: "draftRevisionId does not match the current draft" }, { status: 409 });
  }
  if (draft.content_hash !== body.contentHash) {
    return NextResponse.json({ error: "stale_approval", details: "the draft changed since this approval was prepared" }, { status: 409 });
  }

  const { data: approval, error: approvalError } = await supabase
    .from("approvals")
    .insert({
      draft_revision_id: draft.id,
      reviewer_email: researcher.email,
      disposition: legacyDisposition(body.briefAccurate, body.evidenceRelation),
      brief_accurate: body.briefAccurate,
      evidence_relation: body.evidenceRelation,
      scope_justification: body.scopeJustification,
      content_hash: draft.content_hash,
    })
    .select("id, disposition, approved_at")
    .single();
  if (approvalError || !approval) return NextResponse.json({ error: "server_error" }, { status: 500 });

  // Genuinely terminal: the evidence doesn't cover this specific claim at
  // all. Nothing a draft revision can fix.
  if (body.evidenceRelation === "outside_scope") {
    const t = await transitionSession(supabase, id, "pending_review", session.revision, ["refused"]);
    if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
    await recordAuditEvent({ actorType: "researcher", actorId: researcher.email, action: "refused", entityType: "sessions", entityId: id, after: { evidenceRelation: body.evidenceRelation } });
    return NextResponse.json({ ok: true, outcome: "refused" });
  }

  // Actionable return path, not a terminal refusal: an inaccurate brief
  // needs a revised draft; "unresolved" means more work, not a dead end.
  // Back to 'assigned' — "Generate draft" becomes available again.
  if (!body.briefAccurate || body.evidenceRelation === "unresolved") {
    const t = await transitionSession(supabase, id, "pending_review", session.revision, ["assigned"]);
    if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
    await recordAuditEvent({
      actorType: "researcher",
      actorId: researcher.email,
      action: "returned_for_revision",
      entityType: "sessions",
      entityId: id,
      after: { briefAccurate: body.briefAccurate, evidenceRelation: body.evidenceRelation },
    });
    return NextResponse.json({ ok: true, outcome: "needs_revision" });
  }

  // supports | qualifies | contradicts, with an accurate brief: deliver.
  // The claim-to-source map and exact delivered text are unchanged by
  // which of these three it is — only the recorded relationship differs,
  // so a contradicted belief is never mislabeled as supported.
  const { data: assignment } = await supabase.from("assignments").select("pack_id").eq("session_id", id).maybeSingle();
  const pack = assignment ? EVIDENCE_PACKS[assignment.pack_id] : null;
  const sourceMap = (draft.claim_order as string[]).map((claimId) => {
    const claim = pack?.claims.find((c) => c.id === claimId);
    return { claimId, sourceTitle: claim?.sourceTitle ?? "unknown", url: claim?.url ?? "", locator: claim?.locator ?? "" };
  });

  const { error: deliveryError } = await supabase.from("deliveries").insert({
    session_id: id,
    approval_id: approval.id,
    exact_text: draft.rendered_text,
    exact_html: draft.rendered_html,
    claim_ids: draft.claim_order,
    source_map: sourceMap,
    boundary_text: pack?.boundary ?? "",
    template_version: draft.template_version,
    content_hash: draft.content_hash,
  });
  if (deliveryError) {
    // deliveries.session_id is UNIQUE, so a true concurrent double-click
    // (two requests both reading state=pending_review before either
    // writes) can race to this insert, but only one can ever succeed —
    // the loser hits a unique-violation (23505), not a duplicate delivery.
    if (deliveryError.code === "23505") {
      return NextResponse.json({ error: "already_approved", details: "this session was already approved and delivered" }, { status: 409 });
    }
    // Tier 2 item 11: deliveries_block_if_withdrawn (migration 0017) raises
    // inside the INSERT itself if the participant withdrew between our
    // session read above and this write — checked and enforced atomically
    // in the same statement, not a separate app-level re-check with its
    // own race window.
    if (deliveryError.message.includes("was withdrawn")) {
      return NextResponse.json({ error: "invalid_state", details: "participant withdrew before delivery could be recorded" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const t = await transitionSession(supabase, id, "pending_review", session.revision, ["approved", "delivered"]);
  if (!t.ok) {
    if (t.reason === "stale_revision") {
      return NextResponse.json({ error: "already_approved", details: "this session was already approved and delivered" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });
  }

  await recordAuditEvent({
    actorType: "researcher",
    actorId: researcher.email,
    action: "approved_and_delivered",
    entityType: "sessions",
    entityId: id,
    after: { briefAccurate: body.briefAccurate, evidenceRelation: body.evidenceRelation },
  });

  return NextResponse.json({ ok: true, outcome: "delivered" });
}
