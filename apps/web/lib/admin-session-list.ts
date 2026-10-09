import "server-only";
import { getServiceClient } from "./supabase/service-client";

export type DataFilter = "real" | "test" | "all";

export interface AdminSessionRow {
  id: string;
  pilotLabel: string | null;
  state: string;
  topic: string | null;
  parkReason: string | null;
  /** Distinct from parkReason — a bounded repair also failed; state is
   * still 'discovery', never conflated with a substantive park here. */
  discoveryRecoveryReason: string | null;
  needsResearcherReview: boolean;
  isTest: boolean;
  createdAt: string;
  lastParticipantActivityAt: string | null;
  followupDueAt: string | null;
}

export interface SessionListParams {
  state?: string;
  filter: DataFilter;
  pilot?: string;
}

/**
 * Read-only. "Last participant activity" is derived from the participant's
 * own messages, never from sessions.updated_at — the is_test migration
 * (0011) bumped updated_at on old rows as a side effect of marking them
 * test, so updated_at no longer reflects real participant activity.
 */
export async function getAdminSessionList(params: SessionListParams): Promise<AdminSessionRow[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from("sessions")
    .select("id, state, pack_topic, park_reason, discovery_recovery_reason, needs_researcher_review, is_test, created_at, pilot_label")
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.state) query = query.eq("state", params.state);
  if (params.filter === "real") query = query.eq("is_test", false);
  else if (params.filter === "test") query = query.eq("is_test", true);
  if (params.pilot) query = query.eq("pilot_label", params.pilot);

  const { data: sessions, error } = await query;
  if (error) throw new Error(error.message);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  const [{ data: participantMessages }, { data: followups }] = await Promise.all([
    supabase.from("messages").select("session_id, created_at").eq("role", "participant").in("session_id", sessionIds),
    supabase.from("followups").select("session_id, due_at").in("session_id", sessionIds),
  ]);

  const lastActivityBySession = new Map<string, string>();
  for (const m of participantMessages ?? []) {
    const current = lastActivityBySession.get(m.session_id);
    if (!current || m.created_at > current) lastActivityBySession.set(m.session_id, m.created_at);
  }
  const followupDueBySession = new Map<string, string>();
  for (const f of followups ?? []) followupDueBySession.set(f.session_id, f.due_at);

  return sessions.map((s) => ({
    id: s.id,
    pilotLabel: s.pilot_label,
    state: s.state,
    topic: s.pack_topic,
    parkReason: s.park_reason,
    discoveryRecoveryReason: s.discovery_recovery_reason,
    needsResearcherReview: s.needs_researcher_review,
    isTest: s.is_test,
    createdAt: s.created_at,
    lastParticipantActivityAt: lastActivityBySession.get(s.id) ?? null,
    followupDueAt: followupDueBySession.get(s.id) ?? null,
  }));
}
