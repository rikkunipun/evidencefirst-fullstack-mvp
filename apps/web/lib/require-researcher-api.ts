import "server-only";
import { NextResponse } from "next/server";
import { requireResearcher, type AuthorizedResearcher } from "./supabase/admin-auth";

/** Every /api/admin/* route must call this itself — the dashboard layout guard does not protect direct API requests. */
export async function requireResearcherOrResponse(): Promise<AuthorizedResearcher | NextResponse> {
  const researcher = await requireResearcher();
  if (!researcher) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return researcher;
}
