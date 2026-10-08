"use client";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { apiPost } from "@/lib/api-client";
import type { SessionSnapshot } from "@/lib/types/session";

export function DiscoveryView({ sessionId, snapshot, onAdvance }: { sessionId: string; snapshot: SessionSnapshot; onAdvance: () => Promise<void> }) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assistantMessages = snapshot.messages.filter((m) => m.role === "assistant");
  const currentQuestion = assistantMessages[assistantMessages.length - 1]?.content ?? null;
  const history = snapshot.messages.slice(0, -1);

  async function submit() {
    if (!answer.trim() && snapshot.messages.length > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/messages`, { content: snapshot.messages.length === 0 ? null : answer.trim(), inputMode: "text" });
      setAnswer("");
      await onAdvance();
    } catch {
      setError("Something went wrong sending your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Very first load for this session: no question yet, kick off discovery automatically.
  const kickedOff = useRef(false);
  useEffect(() => {
    if (snapshot.messages.length === 0 && !kickedOff.current) {
      kickedOff.current = true;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.messages.length]);

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
          />
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button onClick={submit} disabled={submitting || !answer.trim()}>
            {submitting ? "Sending…" : "Send"}
          </Button>
        </>
      ) : (
        <p className="text-sm text-[var(--ef-muted)]">Getting started…</p>
      )}
    </Card>
  );
}
