"use client";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { apiPost, ApiTimeoutError } from "@/lib/api-client";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

interface MessagesResponse {
  assistantQuestion: string | null;
  done: boolean;
  duplicate?: boolean;
  inFlight?: boolean;
  recovery?: boolean;
  reason?: string;
}

export function DiscoveryView({ sessionId, snapshot, onAdvance }: { sessionId: string; snapshot: ParticipantSessionSnapshot; onAdvance: () => Promise<void> }) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewRequested, setReviewRequested] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);

  const assistantMessages = snapshot.messages.filter((m) => m.role === "assistant");
  const currentQuestion = assistantMessages[assistantMessages.length - 1]?.content ?? null;
  const history = snapshot.messages.slice(0, -1);
  const recoveryReason = snapshot.session.discoveryRecoveryReason;

  // Same token for repeated Retry presses of the same unsent answer; a new
  // token once the answer actually changes (a genuinely new attempt). This
  // is what lets the server tell a resend of a timed-out request apart
  // from a real second answer.
  const attemptRef = useRef<{ forAnswer: string; token: string } | null>(null);
  function tokenForCurrentAttempt(): string {
    if (attemptRef.current?.forAnswer === answer) return attemptRef.current.token;
    const token = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    attemptRef.current = { forAnswer: answer, token };
    return token;
  }

  // A retried answer whose turn is still being processed server-side must
  // keep polling/reconnecting until that turn completes — not dedupe-and-
  // stop, which could otherwise strand the participant on "Getting
  // started" forever if their own retry landed before the original
  // request finished.
  async function pollUntilComplete(body: { content: string | null; inputMode: "text"; clientToken: string }) {
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const res = await apiPost<MessagesResponse>(`/api/sessions/${sessionId}/messages`, body);
      if (!(res.duplicate && res.inFlight)) return;
    }
  }

  async function submit() {
    if (!answer.trim() && snapshot.messages.length > 0) return;
    setSubmitting(true);
    setError(null);
    const clientToken = tokenForCurrentAttempt();
    const body = { content: snapshot.messages.length === 0 ? null : answer.trim(), inputMode: "text" as const, clientToken };
    try {
      // The typed answer (`answer`) is intentionally left in the textarea
      // until a response actually succeeds — a failed or timed-out request
      // never loses what the participant wrote, so retrying just means
      // pressing the button again with the same text still in place.
      const res = await apiPost<MessagesResponse>(`/api/sessions/${sessionId}/messages`, body);
      if (res.duplicate && res.inFlight) {
        await pollUntilComplete(body);
      }
      setAnswer("");
      attemptRef.current = null;
      await onAdvance();
    } catch (err) {
      const status = err instanceof Error ? (err as Error & { status?: number }).status : undefined;
      setError(
        err instanceof ApiTimeoutError
          ? "That's taking longer than expected. Your answer wasn't lost — press Retry to try again."
          : status === 429
            ? "You're sending answers faster than we can keep up with — please wait a moment and press Retry."
            : "Something went wrong sending your answer. Your answer wasn't lost — press Retry to try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function requestReview() {
    setRequestingReview(true);
    try {
      await apiPost(`/api/sessions/${sessionId}/request-review`, {});
      setReviewRequested(true);
    } finally {
      setRequestingReview(false);
    }
  }

  // Very first load for this session: no question yet, kick off discovery automatically.
  const kickedOff = useRef(false);
  useEffect(() => {
    if (snapshot.messages.length === 0 && !kickedOff.current && !recoveryReason) {
      kickedOff.current = true;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.messages.length, recoveryReason]);

  if (recoveryReason) {
    return (
      <Card className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">We hit a snag recording that</h1>
        <p className="text-sm text-[var(--ef-ink)]">{recoveryReason}</p>
        {reviewRequested ? (
          <p className="text-sm text-[var(--ef-muted)]">A researcher will review your case. You can also try describing it again below.</p>
        ) : null}
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          className={inputClassName}
          placeholder="Try describing what happened again, in different words…"
          disabled={submitting}
        />
        {submitting && (
          <p className="text-sm text-[var(--ef-muted)] flex items-center gap-2" role="status" aria-live="polite">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-[var(--ef-accent)] border-t-transparent animate-spin" aria-hidden="true" />
            Thinking, usually a few seconds.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button onClick={submit} disabled={submitting || !answer.trim()}>
            {submitting ? "Sending…" : "Try again"}
          </Button>
          <Button variant="secondary" onClick={requestReview} disabled={requestingReview || reviewRequested}>
            {reviewRequested ? "Review requested" : requestingReview ? "Requesting…" : "Ask for researcher review"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      {history.length > 0 && (
        <details className="text-sm text-[var(--ef-muted)]">
          <summary className="cursor-pointer">Previous conversation</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {history.map((m) => (
              <li key={m.id}>
                <span className="font-medium">{m.role === "participant" ? "You" : "Us"}:</span> {m.content}
              </li>
            ))}
          </ul>
        </details>
      )}

      {currentQuestion ? (
        <>
          <h1 className="text-lg font-semibold">{currentQuestion}</h1>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            className={inputClassName}
            placeholder="Type your answer…"
            autoFocus
            disabled={submitting}
          />
          {submitting && (
            <p className="text-sm text-[var(--ef-muted)] flex items-center gap-2" role="status" aria-live="polite">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-[var(--ef-accent)] border-t-transparent animate-spin" aria-hidden="true" />
              Thinking, usually a few seconds.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button onClick={submit} disabled={submitting || !answer.trim()}>
            {submitting ? "Sending…" : error ? "Retry" : "Send"}
          </Button>
        </>
      ) : submitting ? (
        <p className="text-sm text-[var(--ef-muted)] flex items-center gap-2" role="status" aria-live="polite">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-[var(--ef-accent)] border-t-transparent animate-spin" aria-hidden="true" />
          Thinking, usually a few seconds.
        </p>
      ) : error ? (
        <>
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
          <Button onClick={submit}>Retry</Button>
        </>
      ) : (
        <p className="text-sm text-[var(--ef-muted)]">Getting started…</p>
      )}
    </Card>
  );
}
