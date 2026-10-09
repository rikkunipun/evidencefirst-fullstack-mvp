"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { ScorePicker } from "./ScorePicker";
import { apiPost } from "@/lib/api-client";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

type Stage = "reason" | "confirm" | "hypothetical";

function initialStage(snapshot: ParticipantSessionSnapshot): Stage {
  const last = snapshot.cruxPasses[snapshot.cruxPasses.length - 1];
  if (!last) return "reason";
  if (!last.confirmedReason) return "confirm";
  if (last.hypotheticalScore === null) return "hypothetical";
  return "reason";
}

export function CruxView({
  sessionId,
  snapshot,
  onAdvance,
  onParked,
}: {
  sessionId: string;
  snapshot: ParticipantSessionSnapshot;
  onAdvance: () => Promise<void>;
  onParked: () => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>(initialStage(snapshot));
  const [reason, setReason] = useState("");
  const [reflected, setReflected] = useState(snapshot.cruxPasses[snapshot.cruxPasses.length - 1]?.statedReason ?? "");
  const [score, setScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitReason() {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/crux`, { action: "submit_reason", stage: "reason", reason: reason.trim() });
      setReflected(reason.trim());
      setStage("confirm");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReason() {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/crux`, { action: "confirm_reason", stage: "confirm", confirmedReason: reflected.trim() });
      setStage("hypothetical");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitHypothetical() {
    if (score === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ nextStep: string }>(`/api/sessions/${sessionId}/crux`, { action: "submit_hypothetical", stage: "hypothetical", hypotheticalScore: score });
      if (result.nextStep === "submit_reason") {
        setReason("");
        setScore(null);
        setStage("reason");
      } else if (result.nextStep === "pre_evidence") {
        await onAdvance();
      } else if (result.nextStep === "parked") {
        await onParked();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "reason") {
    return (
      <Card className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">What&apos;s your main reason for expecting that?</h1>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClassName} autoFocus />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button onClick={submitReason} disabled={submitting || !reason.trim()}>
          {submitting ? "Sending…" : "Continue"}
        </Button>
      </Card>
    );
  }

  if (stage === "confirm") {
    return (
      <Card className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Is this exactly right?</h1>
        <textarea value={reflected} onChange={(e) => setReflected(e.target.value)} rows={3} className={inputClassName} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button onClick={confirmReason} disabled={submitting || !reflected.trim()}>
          {submitting ? "Confirming…" : "Yes, that's right"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Suppose that reason turned out not to be true.</h1>
      <p className="text-sm font-medium">What would your confidence be then, from 0 to 10?</p>
      <ScorePicker value={score} onChange={setScore} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button onClick={submitHypothetical} disabled={score === null || submitting}>
        {submitting ? "Saving…" : "Continue"}
      </Button>
    </Card>
  );
}
