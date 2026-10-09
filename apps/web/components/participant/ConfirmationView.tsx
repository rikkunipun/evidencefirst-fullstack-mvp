"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { apiPost } from "@/lib/api-client";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

export function ConfirmationView({ sessionId, snapshot, onAdvance }: { sessionId: string; snapshot: ParticipantSessionSnapshot; onAdvance: () => Promise<void> }) {
  const confirmation = snapshot.beliefConfirmation;
  // Tier 2 item 7: the decision read-back and the current empirical claim
  // are confirmed separately so editing one can't silently drag the other
  // along as one blob. A session already in 'confirmation' from before
  // this split shipped has null split fields — fall back to splitting its
  // single combined sentence on " because " (best-effort, never crashes;
  // worst case the whole sentence lands in the narrative box, still
  // editable) rather than losing that in-flight confirmation.
  const hasSplit = Boolean(confirmation?.generatedDecisionNarrative && confirmation?.generatedEmpiricalClaim);
  const fallbackParts = !hasSplit && confirmation?.generatedWording ? confirmation.generatedWording.split(/\sbecause\s/i) : null;

  const [narrative, setNarrative] = useState(confirmation?.generatedDecisionNarrative ?? fallbackParts?.[0] ?? "");
  const [claim, setClaim] = useState(confirmation?.generatedEmpiricalClaim ?? (fallbackParts && fallbackParts.length > 1 ? fallbackParts.slice(1).join(" because ") : "") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/confirm`, { decisionNarrative: narrative.trim(), empiricalClaim: claim.trim() });
      await onAdvance();
    } catch {
      setError("Something went wrong confirming this. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Have we understood your view correctly?</h1>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">What you decided</p>
        <p className="text-sm text-[var(--ef-muted)]">Edit this if any part of the decision itself is wrong.</p>
        <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={2} className={inputClassName} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">The specific expectation we&apos;ll check</p>
        <p className="text-sm text-[var(--ef-muted)]">
          This is the exact thing we&apos;ll compare against evidence, and the scale you&apos;ll later rate your confidence on. Edit it so it matches what you currently
          expect — not just what you expected back then.
        </p>
        <textarea value={claim} onChange={(e) => setClaim(e.target.value)} rows={2} className={inputClassName} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button onClick={submit} disabled={submitting || !narrative.trim() || !claim.trim()}>
        {submitting ? "Confirming…" : "Yes, that's right"}
      </Button>
    </Card>
  );
}
