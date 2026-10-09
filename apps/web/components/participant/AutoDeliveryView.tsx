"use client";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { apiPost, ApiTimeoutError } from "@/lib/api-client";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

interface AutoDeliverResponse {
  outcome?: "delivered" | "parked" | "needs_clarification";
  question?: string;
  reason?: string;
}

/**
 * Item 4: no waiting screen. Auto-kicks off the classify→deliver sequence
 * on mount (same pattern as DiscoveryView's kickoff), shows "Checking the
 * available evidence." while it runs, and — if the one bounded
 * clarification is needed — asks it inline, resubmitting to the same
 * endpoint. A technical failure gets bounded retry with the answer (if
 * any was being typed) preserved, never a dead end.
 */
export function AutoDeliveryView({ sessionId, snapshot, onAdvance }: { sessionId: string; snapshot: ParticipantSessionSnapshot; onAdvance: () => Promise<void> }) {
  const [question, setQuestion] = useState<string | null>(snapshot.session.claimKindClarificationQuestion ?? null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  async function run(clarificationAnswer?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<AutoDeliverResponse>(`/api/sessions/${sessionId}/auto-deliver`, clarificationAnswer ? { clarificationAnswer } : {});
      if (res.outcome === "needs_clarification" && res.question) {
        setQuestion(res.question);
        setAnswer("");
        return;
      }
      // "delivered" or "parked" — either way, refresh to let SessionView
      // render the real next screen (DeliveryView / ParkedView).
      await onAdvance();
    } catch (err) {
      setError(
        err instanceof ApiTimeoutError
          ? "That's taking longer than expected. Nothing has been lost — press Retry."
          : "Something went wrong checking the evidence. Nothing has been lost — press Retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  // Auto-kickoff exactly once per mount, unless we already have a pending
  // clarification question from a previous attempt (resume case) — then
  // wait for the participant's answer instead of re-running blind.
  useEffect(() => {
    if (!startedRef.current && !question) {
      startedRef.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (question) {
    return (
      <Card className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">One more detail</h1>
        <p className="text-sm text-[var(--ef-ink)]">{question}</p>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} className={inputClassName} disabled={busy} autoFocus />
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Button onClick={() => run(answer.trim())} disabled={busy || !answer.trim()}>
          {busy ? "Checking…" : "Send"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-[var(--ef-ink)] flex items-center gap-2" role="status" aria-live="polite">
        {busy && <span className="inline-block h-3 w-3 rounded-full border-2 border-[var(--ef-accent)] border-t-transparent animate-spin" aria-hidden="true" />}
        Checking the available evidence.
      </p>
      {error && (
        <>
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
          <Button onClick={() => run()} disabled={busy} className="self-start">
            Retry
          </Button>
        </>
      )}
    </Card>
  );
}
