import Link from "next/link";
import { Card, PageShell } from "@/components/ui/Card";

export default function LandingPage() {
  return (
    <PageShell>
      <header className="flex flex-col gap-3 pt-6">
        <h1 className="text-2xl font-semibold">EvidenceFirst</h1>
        <p className="text-[var(--ef-muted)]">
          A short research conversation about one recent decision — and, only when reliable sources actually support it, a brief that shows you exactly
          what those sources say.
        </p>
      </header>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">What this is</h2>
        <ul className="list-disc pl-5 text-sm text-[var(--ef-muted)] flex flex-col gap-2">
          <li>An AI-assisted research prototype, not a medical, legal, or financial adviser.</li>
          <li>You can type or speak your answers, one question at a time.</li>
          <li>You can stop at any point — nothing is shared beyond this study.</li>
          <li>If your topic isn't covered by our reviewed sources, we'll tell you honestly instead of guessing.</li>
        </ul>
        <Link
          href="/participate"
          className="inline-flex items-center justify-center rounded-lg bg-[var(--ef-accent)] px-5 py-3 text-base font-medium text-[var(--ef-accent-ink)] min-h-[48px] hover:brightness-110"
        >
          Start
        </Link>
      </Card>

      <p className="text-xs text-[var(--ef-muted)] text-center">
        Researcher? <Link href="/admin/login" className="underline">Sign in to the dashboard</Link>.
      </p>
    </PageShell>
  );
}
