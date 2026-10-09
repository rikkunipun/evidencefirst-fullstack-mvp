"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiPost } from "@/lib/api-client";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

export function DeliveryView({ sessionId, snapshot, onAdvance }: { sessionId: string; snapshot: ParticipantSessionSnapshot; onAdvance: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

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
      <div className="text-sm whitespace-pre-wrap">{snapshot.delivery?.exactText}</div>
      <Button onClick={acknowledge} disabled={busy}>
        {busy ? "Continuing…" : "I've read this — continue"}
      </Button>
    </Card>
  );
}
