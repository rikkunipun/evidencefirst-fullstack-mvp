"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiGet } from "@/lib/api-client";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

export function ReceiptView({ sessionId, snapshot, followupUrl }: { sessionId: string; snapshot: ParticipantSessionSnapshot; followupUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  async function downloadReceipt() {
    const receipt = await apiGet(`/api/sessions/${sessionId}/receipt`);
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evidencefirst-receipt-${sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyFollowupLink() {
    if (!followupUrl) return;
    try {
      await navigator.clipboard.writeText(followupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be denied; the link is still visible and selectable.
    }
  }

  const belief = snapshot.beliefConfirmation?.confirmedWording;
  const scores = {
    before: snapshot.baseline?.baselineScore ?? null,
    preEvidence: snapshot.measurements.find((m) => m.phase === "pre_evidence")?.score ?? null,
    after: snapshot.measurements.find((m) => m.phase === "post_evidence")?.score ?? null,
  };

  return (
    <Card className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Your receipt</h1>
      <p className="text-sm text-[var(--ef-ink)] italic">&ldquo;{belief}&rdquo;</p>
      <ul className="text-sm flex flex-col gap-1">
        <li>Before: {scores.before ?? "—"}/10</li>
        <li>Pre-evidence: {scores.preEvidence ?? "—"}/10</li>
        <li>After: {scores.after ?? "—"}/10</li>
      </ul>

      {followupUrl ? (
        <div className="rounded-lg border border-[var(--ef-accent)] bg-[var(--ef-accent-soft)] p-3 flex flex-col gap-2">
          <p className="text-sm font-medium">Save this link — it&apos;s the only way to reach your 7-day follow-up:</p>
          <a href={followupUrl} className="text-sm text-[var(--ef-accent)] underline break-all">
            {followupUrl}
          </a>
          <Button variant="secondary" onClick={copyFollowupLink} className="self-start">
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-[var(--ef-muted)]">
          {snapshot.followup
            ? `Your follow-up is due ${new Date(snapshot.followup.dueAt).toLocaleDateString()}. If you've lost your follow-up link, it can't be recovered in this version — contact the researcher.`
            : "No follow-up scheduled for this session."}
        </p>
      )}

      <Button variant="secondary" onClick={downloadReceipt}>
        Download receipt (JSON)
      </Button>
    </Card>
  );
}
