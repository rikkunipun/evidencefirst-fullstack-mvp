import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { generateCapabilityToken, hashToken } from "@/lib/capability";
import { recordAuditEvent } from "@/lib/audit";
import { getEnv } from "@/lib/env";

/**
 * Tier 2 item 10. The raw follow-up token is never stored (only its
 * hash — same model as a password), so a lost/refreshed link genuinely
 * cannot be recovered, only safely reissued: a fresh token replaces the
 * old one. due_at is left untouched — the 7-day window is anchored to
 * delivery time, not to when the participant happened to refresh.
 * `followups_block_update_if_collected` (DB trigger) makes it impossible
 * to reissue after the follow-up has already been collected, even under
 * a race with the submission itself.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = getServiceClient();
  const { data: followup } = await supabase.from("followups").select("id, collected_at, due_at").eq("session_id", id).maybeSingle();
  if (!followup) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (followup.collected_at) return NextResponse.json({ alreadyCollected: true });

  const rawToken = generateCapabilityToken();
  const { error } = await supabase.from("followups").update({ token_hash: hashToken(rawToken) }).eq("id", followup.id);
  if (error) {
    // Most likely the collected-at trigger fired on a race with the
    // participant submitting via their still-working old link between our
    // read and this write — that's not a failure, it's already done.
    return NextResponse.json({ alreadyCollected: true });
  }

  await recordAuditEvent({ actorType: "participant", action: "followup_link_reissued", entityType: "followups", entityId: followup.id });

  const followupUrl = `${getEnv().NEXT_PUBLIC_APP_URL}/follow-up/${rawToken}`;
  return NextResponse.json({ followupUrl, dueAt: followup.due_at });
}
