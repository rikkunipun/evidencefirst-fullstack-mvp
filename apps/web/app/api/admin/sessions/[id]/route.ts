import { NextResponse } from "next/server";
import { requireResearcherOrResponse } from "@/lib/require-researcher-api";
import { getServiceClient } from "@/lib/supabase/service-client";
import { loadSessionSnapshot } from "@/lib/session-snapshot";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const researcher = await requireResearcherOrResponse();
  if (researcher instanceof NextResponse) return researcher;
  const { id } = await params;

  const snapshot = await loadSessionSnapshot(id);
  if (!snapshot) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = getServiceClient();
  const [{ data: auditEvents }, { data: extractionHistory }] = await Promise.all([
    supabase.from("audit_events").select("actor_type, actor_id, action, before, after, created_at").eq("entity_id", id).order("created_at", { ascending: true }),
    supabase.from("extraction_snapshots").select("fields, field_evidence, candidate_driver, should_stop, stop_reason, safety, prompt_version, model, request_id, latency_ms, fallback, error, created_at").eq("session_id", id).order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({ ...snapshot, auditEvents: auditEvents ?? [], extractionHistory: extractionHistory ?? [] });
}
