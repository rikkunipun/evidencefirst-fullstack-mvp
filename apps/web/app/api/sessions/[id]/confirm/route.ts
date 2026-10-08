import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { z } from "zod";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";

const bodySchema = z.object({ confirmedWording: z.string().trim().min(1).max(500) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

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

  const { error: updateError } = await supabase
    .from("belief_confirmations")
    .update({ confirmed_wording: parsed.data.confirmedWording, confirmed_at: new Date().toISOString() })
    .eq("id", confirmation.id);
  if (updateError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const t = await transitionSession(supabase, id, "confirmation", session.revision, ["eligibility_check"]);
  if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });

  await recordAuditEvent({ actorType: "participant", action: "belief_confirmed", entityType: "belief_confirmations", entityId: confirmation.id, after: { confirmedWording: parsed.data.confirmedWording } });

  return NextResponse.json({ ok: true });
}
