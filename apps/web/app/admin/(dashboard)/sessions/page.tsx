import Link from "next/link";
import { getAdminSessionList, type DataFilter } from "@/lib/admin-session-list";
import { STATE_LABELS } from "@/lib/state-labels";
import { formatIST } from "@/lib/format-ist";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

function filterLink(state: string | undefined, filter: DataFilter, pilot: string | undefined) {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  params.set("filter", filter);
  if (pilot) params.set("pilot", pilot);
  return `/admin/sessions?${params.toString()}`;
}

export default async function AdminSessionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; filter?: string; pilot?: string }>;
}) {
  const sp = await searchParams;
  const state = sp.state;
  const filter: DataFilter = sp.filter === "test" || sp.filter === "all" ? sp.filter : "real";
  const pilot = sp.pilot?.trim() || undefined;

  const visibleRows = await getAdminSessionList({ state, filter, pilot });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold">
          Sessions{state ? ` — ${STATE_LABELS[state] ?? state}` : ""}
          {pilot ? ` — pilot: ${pilot}` : ""}
          <span className="text-sm font-normal text-[var(--ef-muted)]"> ({visibleRows.length})</span>
          {pilot && (
            <Link href={filterLink(state, filter, undefined)} className="ml-2 text-xs font-normal underline text-[var(--ef-muted)]">
              clear pilot filter
            </Link>
          )}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--ef-muted)]">Data:</span>
          {(["real", "test", "all"] as DataFilter[]).map((f) => (
            <Link
              key={f}
              href={filterLink(state, f, pilot)}
              className={`rounded-lg border px-3 py-1.5 ${f === filter ? "border-[var(--ef-accent)] bg-[var(--ef-accent-soft)]" : "border-[var(--ef-border)] bg-white"}`}
            >
              {f}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--ef-muted)]">All times shown in IST (Asia/Kolkata). Database stores UTC.</p>

      {visibleRows.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--ef-muted)]">No sessions match this filter.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--ef-muted)] border-b border-[var(--ef-border)]">
                <th className="px-4 py-2">Session</th>
                <th className="px-4 py-2">Pilot</th>
                <th className="px-4 py-2">State</th>
                <th className="px-4 py-2">Topic</th>
                <th className="px-4 py-2">Parked reason</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Last participant activity</th>
                <th className="px-4 py-2">Follow-up due</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--ef-border)] last:border-0 align-top">
                  <td className="px-4 py-2">
                    <Link href={`/admin/sessions/${r.id}`} className="font-mono text-xs underline">
                      {r.id.slice(0, 8)}
                    </Link>
                    {r.isTest && <span className="ml-2 text-xs text-amber-700">test</span>}
                  </td>
                  <td className="px-4 py-2">
                    {r.pilotLabel ? (
                      <Link href={filterLink(state, filter, r.pilotLabel)} className="underline text-[var(--ef-accent)]">
                        {r.pilotLabel}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">{STATE_LABELS[r.state] ?? r.state}</td>
                  <td className="px-4 py-2">{r.topic ?? "—"}</td>
                  <td className="px-4 py-2 max-w-xs">{r.parkReason ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatIST(r.createdAt)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatIST(r.lastParticipantActivityAt)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatIST(r.followupDueAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
