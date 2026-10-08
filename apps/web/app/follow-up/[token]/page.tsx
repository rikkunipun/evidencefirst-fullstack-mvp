"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageShell, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { ScorePicker } from "@/components/participant/ScorePicker";
import { apiGet, apiPost } from "@/lib/api-client";

interface FollowupState {
  beliefWording: string | null;
  dueAt: string;
  isDue: boolean;
  alreadyCollected: boolean;
}

export default function FollowUpPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [state, setState] = useState<FollowupState | "loading" | "not_found">("loading");
  const [score, setScore] = useState<number | null>(null);
  const [behavior, setBehavior] = useState("");
  const [otherInfluences, setOtherInfluences] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<FollowupState>(`/api/follow-up/${token}`)
      .then(setState)
      .catch(() => setState("not_found"));
  }, [token]);

  async function submit() {
    if (score === null || !behavior.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/follow-up/${token}`, { score, reportedBehavior: behavior.trim(), otherInfluences: otherInfluences.trim() || null });
      setSubmitted(true);
    } catch {
      setError("Something went wrong submitting this. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <PageShell>
        <Card>
          <p className="text-sm text-[var(--ef-muted)]">Loading…</p>
        </Card>
      </PageShell>
    );
  }

  if (state === "not_found") {
    return (
      <PageShell>
        <Card>
          <h1 className="text-lg font-semibold mb-2">Link not found</h1>
          <p className="text-sm text-[var(--ef-muted)]">This follow-up link is invalid or has expired.</p>
        </Card>
      </PageShell>
    );
  }

  if (!state.isDue) {
    return (
      <PageShell>
        <Card>
          <h1 className="text-lg font-semibold mb-2">Not yet due</h1>
          <p className="text-sm text-[var(--ef-muted)]">Your follow-up opens on {new Date(state.dueAt).toLocaleDateString()}. Please check back then.</p>
        </Card>
      </PageShell>
    );
  }

  if (state.alreadyCollected || submitted) {
    return (
      <PageShell>
        <Card>
          <h1 className="text-lg font-semibold mb-2">Thank you</h1>
          <p className="text-sm text-[var(--ef-muted)]">Your follow-up response has been recorded.</p>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">One-week follow-up</h1>
        <p className="text-sm text-[var(--ef-ink)] italic">&ldquo;{state.beliefWording}&rdquo;</p>
        <p className="text-sm font-medium">Right now, how confident are you in this, from 0 to 10?</p>
        <ScorePicker value={score} onChange={setScore} />
        <Field label="Did the relevant decision or behavior actually happen?" htmlFor="behavior">
          <textarea id="behavior" value={behavior} onChange={(e) => setBehavior(e.target.value)} rows={2} className={inputClassName} />
        </Field>
        <Field label="What else, if anything, affected the result? (optional)" htmlFor="other">
          <input id="other" value={otherInfluences} onChange={(e) => setOtherInfluences(e.target.value)} className={inputClassName} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button onClick={submit} disabled={busy || score === null || !behavior.trim()}>
          {busy ? "Submitting…" : "Submit"}
        </Button>
      </Card>
    </PageShell>
  );
}
