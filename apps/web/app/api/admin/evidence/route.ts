import { NextResponse } from "next/server";
import { requireResearcherOrResponse } from "@/lib/require-researcher-api";
import { getServiceClient } from "@/lib/supabase/service-client";

export async function GET() {
  const researcher = await requireResearcherOrResponse();
  if (researcher instanceof NextResponse) return researcher;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("evidence_units")
    .select("id, pack_id, pack_version, claim_id, claim_text, source_title, source_url, locator, evidence_note, tags, audit_status, audit_date, enabled, scope, boundary")
    .order("pack_id")
    .order("claim_id");
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  return NextResponse.json({ units: data });
}
