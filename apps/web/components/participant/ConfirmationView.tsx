"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { apiPost } from "@/lib/api-client";
import type { SessionSnapshot } from "@/lib/types/session";

export function ConfirmationView({ sessionId, snapshot, onAdvance }: { sessionId: string; snapshot: SessionSnapshot; onAdvance: () => Promise<void> }) {
  const generated = snapshot.beliefConfirmation?.generatedWording ?? "";
  const [wording, setWording] = useState(generated);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/confirm`, { confirmedWording: wording.trim() });
      await onAdvance();
    } catch {
      setError("Something went wrong confirming this. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Have we understood your view correctly?</h1>
      <p className="text-sm text-[var(--ef-muted)]">Edit this if any part is wrong, then confirm.</p>
      <textarea value={wording} onChange={(e) => setWording(e.target.value)} rows={3} className={inputClassName} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button onClick={submit} disabled={submitting || !wording.trim()}>
        {submitting ? "Confirming…" : "Yes, that's right"}
      </Button>
    </Card>
  );
}
