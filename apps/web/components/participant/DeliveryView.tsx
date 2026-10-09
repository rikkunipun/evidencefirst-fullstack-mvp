"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiPost } from "@/lib/api-client";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

export function DeliveryView({ sessionId, snapshot, onAdvance }: { sessionId: string; snapshot: ParticipantSessionSnapshot; onAdvance: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const delivery = snapshot.delivery;

  async function acknowledge() {
    setBusy(true);
    try {
      await apiPost(`/api/sessions/${sessionId}/ack`, {});
      await onAdvance();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Information for you</h1>
      {delivery?.exactHtml ? (
        // This HTML is server-composed from our own evidence-pack text and a
        // fixed template (see lib/delivery-template.ts) — never from a model
        // or from user input — so rendering it directly is safe.
        <div
          className="text-sm [&_a]:text-[var(--ef-accent)] [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-2"
          dangerouslySetInnerHTML={{ __html: delivery.exactHtml }}
        />
      ) : (
        <div className="text-sm whitespace-pre-wrap">{delivery?.exactText}</div>
      )}
      <Button onClick={acknowledge} disabled={busy}>
        {busy ? "Continuing…" : "I've read this — continue"}
      </Button>
    </Card>
  );
}
