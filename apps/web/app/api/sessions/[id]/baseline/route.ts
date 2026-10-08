import { NextResponse, type NextRequest } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { getServiceClient } from "@/lib/supabase/service-client";
import { baselineSchema } from "@/lib/zod/requests";
import { transitionSession } from "@/lib/session-transition";
import { recordAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireSessionAccess(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = baselineSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

  const supabase = getServiceClient();
  const { data: session } = await supabase.from("sessions").select("state, revision").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.state !== "eligibility_check") return NextResponse.json({ error: "invalid_state", state: session.state }, { status: 409 });

  const { data: eligibility } = await supabase
    .from("eligibility_evaluations")
    .select("disposition, scope_and_time, consequence_occurred, consequence_evidence")
    .eq("session_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!eligibility || eligibility.disposition !== "eligible") {
    return NextResponse.json({ error: "invalid_state", details: "eligibility must pass before baseline" }, { status: 409 });
  }

  const { data: confirmation } = await supabase
    .from("belief_confirmations")
    .select("confirmed_wording")
    .eq("session_id", id)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!confirmation?.confirmed_wording) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const { data: existing } = await supabase.from("baseline_snapshots").select("id").eq("session_id", id).maybeSingle();
  if (existing) return NextResponse.json({ error: "invalid_state", details: "baseline already frozen" }, { status: 409 });

  const { error: insertError } = await supabase.from("baseline_snapshots").insert({
    session_id: id,
    belief_wording: confirmation.confirmed_wording,
    scope_and_time: eligibility.scope_and_time,
    consequence_text: eligibility.consequence_occurred ? "An actual cost was reported." : null,
    consequence_evidence: eligibility.consequence_evidence,
    baseline_score: parsed.data.baselineScore,
  });
  if (insertError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const t = await transitionSession(supabase, id, "eligibility_check", session.revision, ["baseline_frozen", "crux"]);
  if (!t.ok) return NextResponse.json({ error: "server_error", reason: t.reason }, { status: 500 });

  await recordAuditEvent({ actorType: "participant", action: "baseline_frozen", entityType: "sessions", entityId: id, after: { baselineScore: parsed.data.baselineScore } });

  return NextResponse.json({ ok: true, baselineScore: parsed.data.baselineScore });
}
