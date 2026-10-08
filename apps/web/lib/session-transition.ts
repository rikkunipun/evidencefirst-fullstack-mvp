import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertTransition, type SessionState } from "./state-machine";

/**
 * Optimistic-concurrency state update: asserts every hop in `path` is a
 * legal transition, then writes only the final state with one revision
 * bump, guarded by `eq("revision", expectedRevision)`. Collapsing
 * intermediate "pass-through" states into one write is fine as long as
 * each hop is individually valid — it's a logical checkpoint, not a
 * requirement to persist every micro-state.
 */
export async function transitionSession(
  supabase: SupabaseClient,
  sessionId: string,
  fromState: SessionState,
  expectedRevision: number,
  path: SessionState[],
  extraPatch: Record<string, unknown> = {},
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let cursor = fromState;
  for (const next of path) {
    assertTransition(cursor, next);
    cursor = next;
  }
  const finalState = path[path.length - 1];

  const { data, error } = await supabase
    .from("sessions")
    .update({ state: finalState, revision: expectedRevision + 1, ...extraPatch })
    .eq("id", sessionId)
    .eq("revision", expectedRevision)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: false, reason: "stale_revision" };
  return { ok: true };
}
