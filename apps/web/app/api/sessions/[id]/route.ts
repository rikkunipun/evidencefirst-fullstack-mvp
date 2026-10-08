import { NextResponse } from "next/server";
import { requireSessionAccess } from "@/lib/session-auth";
import { loadSessionSnapshot } from "@/lib/session-snapshot";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authorized = await requireSessionAccess(id);
  if (!authorized) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const snapshot = await loadSessionSnapshot(id);
  if (!snapshot) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(snapshot);
}
