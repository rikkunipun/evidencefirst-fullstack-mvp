import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service-client";
import { SESSION_STATES } from "@/lib/state-machine";
import { STATE_LABELS } from "@/lib/state-labels";
import { formatIST } from "@/lib/format-ist";
import { Card } from "@/components/ui/Card";
import type { DataFilter } from "@/lib/admin-session-list";

export const dynamic = "force-dynamic";

async function getStateCounts(filter: DataFilter) {
  const supabase = getServiceClient();
  let query = supabase.from("sessions").select("id, state");
  if (filter === "real") query = query.eq("is_test", false);
  else if (filter === "test") query = query.eq("is_test", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const state of SESSION_STATES) counts.set(state, 0);
  for (const row of data ?? []) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
  return counts;
}

async function getQueue(filter: DataFilter) {
  const supabase = getServiceClient();
  let query = supabase
    .from("sessions")
    .select("id, state, pack_topic, created_at, updated_at")
    .in("state", ["pending_review", "eligibility_check", "discovery"])
    .order("updated_at", { ascending: true })
    .limit(50);
  if (filter === "real") query = query.eq("is_test", false);
  else if (filter === "test") query = query.eq("is_test", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function AdminHomePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  const filter: DataFilter = sp.filter === "test" || sp.filter === "all" ? sp.filter : "real";

  const [counts, queue] = await Promise.all([getStateCounts(filter), getQueue(filter)]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold">Session states</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--ef-muted)]">Data:</span>
          {(["real", "test", "all"] as DataFilter[]).map((f) => (
            <Link
              key={f}
              href={`/admin?filter=${f}`}
              className={`rounded-lg border px-3 py-1.5 ${f === filter ? "border-[var(--ef-accent)] bg-[var(--ef-accent-soft)]" : "border-[var(--ef-border)] bg-white"}`}
            >
              {f}
            </Link>
          ))}
        </div>
      </div>

      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {SESSION_STATES.map((state) => (
            <Link key={state} href={`/admin/sessions?state=${state}&filter=${filter}`}>
              <Card className="p-4 hover:border-[var(--ef-accent)] transition-colors cursor-pointer">
                <div className="text-2xl font-semibold">{counts.get(state) ?? 0}</div>
                <div className="text-xs text-[var(--ef-muted)]">{STATE_LABELS[state] ?? state}</div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Needs attention</h2>
        {queue.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--ef-muted)]">No sessions currently in discovery, eligibility review, or pending approval.</p>
          </Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--ef-muted)] border-b border-[var(--ef-border)]">
                  <th className="px-4 py-2">Session</th>
                  <th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">Topic</th>
                  <th className="px-4 py-2">Updated (IST)</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--ef-border)] last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/admin/sessions/${s.id}`} className="font-mono text-xs underline">
                        {s.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{STATE_LABELS[s.state] ?? s.state}</td>
                    <td className="px-4 py-2">{s.pack_topic ?? "—"}</td>
                    <td className="px-4 py-2">{formatIST(s.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
