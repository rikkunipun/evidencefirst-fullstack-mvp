import { Card } from "@/components/ui/Card";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

export function ParkedView({ snapshot }: { snapshot: ParticipantSessionSnapshot }) {
  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Thank you for sharing this</h1>
      <p className="text-sm text-[var(--ef-ink)]">
        {snapshot.session.parkReason ?? "This particular case doesn't fit what this study can evaluate right now."}
      </p>
      <p className="text-sm text-[var(--ef-muted)]">
        This isn't a judgment of your decision — it just means we don't have a way to check this specific thing yet. Your response has been recorded for the
        study. You can close this page at any time.
      </p>
    </Card>
  );
}
