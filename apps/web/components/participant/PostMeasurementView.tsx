"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { ScorePicker } from "./ScorePicker";
import { apiPost } from "@/lib/api-client";

export function PostMeasurementView({ sessionId, beliefWording, onAdvance }: { sessionId: string; beliefWording: string; onAdvance: (followupUrl: string) => void }) {
  const [score, setScore] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [behavior, setBehavior] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (score === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ followupUrl: string }>(`/api/sessions/${sessionId}/measurements`, {
        score,
        explanation: explanation.trim() || null,
        reportedBehavior: behavior.trim() || null,
      });
      onAdvance(result.followupUrl);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Your response</h1>
      <p className="text-sm text-[var(--ef-ink)] italic">&ldquo;{beliefWording}&rdquo;</p>
      <p className="text-sm font-medium">Right now, how confident are you in this, from 0 to 10?</p>
      <ScorePicker value={score} onChange={setScore} />
      <Field label="Which point changed, failed to change, or complicated your view, and why?" htmlFor="explanation">
        <textarea id="explanation" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} className={inputClassName} />
      </Field>
      <Field label="What, if anything, will you do differently?" htmlFor="behavior">
        <textarea id="behavior" value={behavior} onChange={(e) => setBehavior(e.target.value)} rows={2} className={inputClassName} />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button onClick={submit} disabled={score === null || busy}>
        {busy ? "Saving…" : "Submit"}
      </Button>
    </Card>
  );
}
