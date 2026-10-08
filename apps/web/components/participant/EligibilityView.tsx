"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { apiPost } from "@/lib/api-client";

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-lg border px-4 py-2 text-sm min-h-[44px] ${value === true ? "border-[var(--ef-accent)] bg-[var(--ef-accent-soft)]" : "border-[var(--ef-border)] bg-white"}`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-lg border px-4 py-2 text-sm min-h-[44px] ${value === false ? "border-[var(--ef-accent)] bg-[var(--ef-accent-soft)]" : "border-[var(--ef-border)] bg-white"}`}
        >
          No
        </button>
      </div>
    </div>
  );
}

export function EligibilityView({ sessionId, beliefWording, onAdvance, onParked }: { sessionId: string; beliefWording: string; onAdvance: () => Promise<void>; onParked: () => Promise<void> }) {
  const [stillHolds, setStillHolds] = useState<boolean | null>(null);
  const [scopeAndTime, setScopeAndTime] = useState("");
  const [materially, setMaterially] = useState<boolean | null>(null);
  const [consequenceOccurred, setConsequenceOccurred] = useState<boolean | null>(null);
  const [consequenceEvidence, setConsequenceEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = stillHolds !== null && scopeAndTime.trim() && materially !== null && consequenceOccurred !== null && (!consequenceOccurred || consequenceEvidence.trim());

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ disposition: string }>(`/api/sessions/${sessionId}/eligibility`, {
        stillHoldsBelief: stillHolds,
        scopeAndTime: scopeAndTime.trim(),
        materiallyAffectedDecision: materially,
        consequenceOccurred,
        consequenceEvidence: consequenceOccurred ? consequenceEvidence.trim() : null,
      });
      if (result.disposition === "parked") await onParked();
      else await onAdvance();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <h1 className="text-lg font-semibold">A few quick checks</h1>
      <p className="text-sm text-[var(--ef-ink)] italic">&ldquo;{beliefWording}&rdquo;</p>

      <YesNo label="Is this still what you expect today?" value={stillHolds} onChange={setStillHolds} />

      <Field label="What's the scope or timeframe? (e.g. for general fitness, this semester)" htmlFor="scope">
        <input id="scope" value={scopeAndTime} onChange={(e) => setScopeAndTime(e.target.value)} className={inputClassName} />
      </Field>

      <YesNo label="Did this expectation actually affect your decision?" value={materially} onChange={setMaterially} />

      <YesNo label="Has an actual cost already happened — money, time, or health?" value={consequenceOccurred} onChange={setConsequenceOccurred} />

      {consequenceOccurred && (
        <Field label="What tells you that happened?" htmlFor="evidence">
          <input id="evidence" value={consequenceEvidence} onChange={(e) => setConsequenceEvidence(e.target.value)} className={inputClassName} />
        </Field>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <Button onClick={submit} disabled={!ready || submitting}>
        {submitting ? "Checking…" : "Continue"}
      </Button>
    </Card>
  );
}
