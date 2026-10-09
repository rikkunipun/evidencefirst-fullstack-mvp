"use client";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// Backoff schedule for automatic polling: frequent enough to feel live
// early on, without hammering the server if a review genuinely takes a
// while. Capped, not unbounded — after the last step it keeps polling at
// the cap rather than stopping, so a long review still eventually surfaces
// without the participant needing to touch anything.
const POLL_SCHEDULE_MS = [5_000, 5_000, 10_000, 15_000, 30_000, 60_000];

export function WaitingView({ onAdvance }: { onAdvance: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);
  const mountedRef = useRef(true);
  const stepRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const delay = POLL_SCHEDULE_MS[Math.min(stepRef.current, POLL_SCHEDULE_MS.length - 1)];
      stepRef.current += 1;
      timer = setTimeout(async () => {
        if (!mountedRef.current) return;
        try {
          await onAdvance();
        } catch {
          // Transient network/server hiccup — keep polling, don't surface
          // an error for a background check the participant didn't ask for.
        } finally {
          if (mountedRef.current) scheduleNext();
        }
      }, delay);
    }
    scheduleNext();

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkNow() {
    setChecking(true);
    try {
      await onAdvance();
    } catch {
      // Swallow — the automatic poll will retry; nothing new to tell the
      // participant beyond "still checking".
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">Thanks — we&apos;re reviewing your case</h1>
      <p className="text-sm text-[var(--ef-muted)]">
        A researcher checks every response against our sources before it&apos;s shown to anyone. This usually doesn&apos;t take long. This page checks automatically every so
        often — you can also close it and come back later, or check right now.
      </p>
      <Button variant="secondary" onClick={checkNow} disabled={checking} className="self-start">
        {checking ? "Checking…" : "Check review status"}
      </Button>
    </Card>
  );
}
