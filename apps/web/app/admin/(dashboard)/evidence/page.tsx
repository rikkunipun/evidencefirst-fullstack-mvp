import { getServiceClient } from "@/lib/supabase/service-client";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function AdminEvidencePage() {
  const supabase = getServiceClient();
  const { data: units } = await supabase
    .from("evidence_units")
    .select("pack_id, pack_version, claim_id, claim_text, source_title, source_url, locator, tags, audit_status, audit_date, enabled")
    .order("pack_id")
    .order("claim_id");

  const byPack = new Map<string, typeof units>();
  for (const u of units ?? []) {
    const key = `${u.pack_id} v${u.pack_version}`;
    byPack.set(key, [...(byPack.get(key) ?? []), u]);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Evidence library</h1>
      <p className="text-sm text-[var(--ef-muted)]">
        Read-only view of the versioned evidence units stored in the database. Delivery composition currently reads the matching in-code constants
        (identical content, seeded from this table) — toggling a row here does not yet change what gets delivered. Edit the source in <code>lib/evidence.ts</code> and
        re-seed to change content; that produces a new version, never an in-place edit.
      </p>
      {[...byPack.entries()].map(([pack, rows]) => (
        <Card key={pack}>
          <h2 className="font-semibold mb-3">{pack}</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {rows!.map((u) => (
              <li key={u.claim_id} className="border-b border-[var(--ef-border)] pb-2 last:border-0">
                <div className="flex justify-between">
                  <span className="font-mono text-xs">{u.claim_id}</span>
                  <span className={`text-xs font-medium ${u.enabled ? "text-green-700" : "text-red-700"}`}>{u.enabled ? "enabled" : "disabled"}</span>
                </div>
                <p>{u.claim_text}</p>
                <p className="text-xs text-[var(--ef-muted)]">
                  {u.source_title} · {u.locator} · audited {u.audit_date}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
