"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScorePicker } from "./ScorePicker";
import { apiPost } from "@/lib/api-client";

export function PreEvidenceView({ sessionId, beliefWording, onAdvance }: { sessionId: string; beliefWording: string; onAdvance: () => Promise<void> }) {
  const [score, setScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (score === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/pre-evidence`, { score });
      await onAdvance();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">One more check before we show you anything</h1>
      <p className="text-sm text-[var(--ef-ink)] italic">&ldquo;{beliefWording}&rdquo;</p>
      <p className="text-sm font-medium">Right now, how confident are you, from 0 to 10?</p>
      <ScorePicker value={score} onChange={setScore} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button onClick={submit} disabled={score === null || submitting}>
        {submitting ? "Saving…" : "Continue"}
      </Button>
    </Card>
  );
}
