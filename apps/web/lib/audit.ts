import "server-only";
import { getServiceClient } from "./supabase/service-client";

export async function recordAuditEvent(params: {
  actorType: "system" | "model" | "researcher" | "participant";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from("audit_events").insert({
    actor_type: params.actorType,
    actor_id: params.actorId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
  });
  // Audit logging must never crash the primary request; log and continue.
  if (error) console.error(`audit_events insert failed: ${error.message}`);
}
