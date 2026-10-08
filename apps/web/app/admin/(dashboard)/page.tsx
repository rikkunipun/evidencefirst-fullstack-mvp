import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service-client";
import { SESSION_STATES } from "@/lib/state-machine";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const STATE_LABELS: Record<string, string> = {
  consented: "Consented",
  context: "Context",
  discovery: "Discovery",
  confirmation: "Confirmation",
  eligibility_check: "Eligibility check",
  parked: "Parked",
  baseline_frozen: "Baseline frozen",
  crux: "Crux",
  pre_evidence_recorded: "Pre-evidence recorded",
  assigned: "Assigned",
  pending_review: "Pending review",
  refused: "Refused",
  approved: "Approved",
  delivered: "Delivered",
  ack_recorded: "Ack recorded",
  measured: "Measured",
  followup_due: "Follow-up due",
  complete: "Complete",
  withdrawn: "Withdrawn",
};

async function getStateCounts() {
  const supabase = getServiceClient();
  const { data, error } = await supabase.from("sessions").select("id, state");
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const state of SESSION_STATES) counts.set(state, 0);
  for (const row of data ?? []) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
  return counts;
}

async function getQueue() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, state, pack_topic, created_at, updated_at")
    .in("state", ["pending_review", "eligibility_check", "discovery"])
    .order("updated_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function AdminHomePage() {
  const [counts, queue] = await Promise.all([getStateCounts(), getQueue()]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-lg font-semibold mb-3">Session states</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {SESSION_STATES.map((state) => (
            <Card key={state} className="p-4">
              <div className="text-2xl font-semibold">{counts.get(state) ?? 0}</div>
              <div className="text-xs text-[var(--ef-muted)]">{STATE_LABELS[state] ?? state}</div>
            </Card>
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
                  <th className="px-4 py-2">Updated</th>
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
                    <td className="px-4 py-2">{new Date(s.updated_at).toLocaleString()}</td>
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
