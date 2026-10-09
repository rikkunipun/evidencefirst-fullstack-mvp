import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

export function ParkedView({ snapshot }: { snapshot: ParticipantSessionSnapshot }) {
  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Thank you for sharing this</h1>
      <p className="text-sm text-[var(--ef-ink)]">
        {snapshot.session.parkReason?.trim() ? snapshot.session.parkReason : "This particular case doesn't fit what this study can evaluate right now."}
      </p>
      <p className="text-sm text-[var(--ef-muted)]">
        This isn&apos;t a judgment of your decision — it just means we don&apos;t have a way to check this specific thing yet. Your response has been recorded for the
        study.
      </p>
      <Link
        href="/participate"
        className="inline-flex items-center justify-center rounded-lg border border-[var(--ef-border)] bg-white px-5 py-3 text-base font-medium text-[var(--ef-ink)] min-h-[48px] hover:bg-[var(--ef-accent-soft)] self-start"
      >
        Try a different decision
      </Link>
    </Card>
  );
}
