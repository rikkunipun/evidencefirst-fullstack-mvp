"use client";
import { useCallback, useState } from "react";
import { PageShell } from "@/components/ui/Card";
import { ProgressLabel } from "./ProgressLabel";
import { DiscoveryView } from "./DiscoveryView";
import { ConfirmationView } from "./ConfirmationView";
import { EligibilityView } from "./EligibilityView";
import { BaselineView } from "./BaselineView";
import { CruxView } from "./CruxView";
import { PreEvidenceView } from "./PreEvidenceView";
import { WaitingView } from "./WaitingView";
import { ParkedView } from "./ParkedView";
import { DeliveryView } from "./DeliveryView";
import { PostMeasurementView } from "./PostMeasurementView";
import { ReceiptView } from "./ReceiptView";
import { apiGet, apiPost } from "@/lib/api-client";
import type { ParticipantSessionSnapshot } from "@/lib/types/session";

const PROCEEDABLE_CLASSIFICATIONS = new Set(["current_claim", "near_term_test"]);

export function SessionView({ sessionId, initialSnapshot }: { sessionId: string; initialSnapshot: ParticipantSessionSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [withdrawing, setWithdrawing] = useState(false);
  const [followupUrl, setFollowupUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const latest = await apiGet<ParticipantSessionSnapshot>(`/api/sessions/${sessionId}`);
    setSnapshot(latest);
  }, [sessionId]);

  async function withdraw() {
    setWithdrawing(true);
    try {
      await apiPost(`/api/sessions/${sessionId}/withdraw`, {});
      await refresh();
    } finally {
      setWithdrawing(false);
    }
  }

  const beliefWording = snapshot.beliefConfirmation?.confirmedWording ?? snapshot.beliefConfirmation?.generatedWording ?? "";
  const canWithdraw = !["parked", "refused", "withdrawn", "complete"].includes(snapshot.session.state);

  function renderBody() {
    switch (snapshot.session.state) {
      case "consented":
      case "context":
      case "discovery":
        return <DiscoveryView sessionId={sessionId} snapshot={snapshot} onAdvance={refresh} />;
      case "confirmation":
        return <ConfirmationView sessionId={sessionId} snapshot={snapshot} onAdvance={refresh} />;
      case "eligibility_check":
        if (snapshot.eligibility?.disposition === "eligible") {
          return <BaselineView sessionId={sessionId} beliefWording={beliefWording} onAdvance={refresh} />;
        }
        return <EligibilityView sessionId={sessionId} beliefWording={beliefWording} onAdvance={refresh} onParked={refresh} />;
      case "crux":
        if (snapshot.cruxClassification && PROCEEDABLE_CLASSIFICATIONS.has(snapshot.cruxClassification)) {
          return <PreEvidenceView sessionId={sessionId} beliefWording={beliefWording} onAdvance={refresh} />;
        }
        return <CruxView sessionId={sessionId} snapshot={snapshot} onAdvance={refresh} onParked={refresh} />;
      case "assigned":
      case "pending_review":
      case "approved":
        return <WaitingView />;
      case "delivered":
        return <DeliveryView sessionId={sessionId} snapshot={snapshot} onAdvance={refresh} />;
      case "ack_recorded":
        return (
          <PostMeasurementView
            sessionId={sessionId}
            beliefWording={beliefWording}
            onAdvance={(url) => {
              setFollowupUrl(url);
              void refresh();
            }}
          />
        );
      case "measured":
      case "followup_due":
      case "complete":
        return <ReceiptView sessionId={sessionId} snapshot={snapshot} followupUrl={followupUrl} />;
      case "parked":
      case "refused":
        return <ParkedView snapshot={snapshot} />;
      case "withdrawn":
        return (
          <div className="rounded-2xl border border-[var(--ef-border)] bg-white p-6">
            <h1 className="text-lg font-semibold mb-2">You've stopped this session</h1>
            <p className="text-sm text-[var(--ef-muted)]">Nothing further will be shown to you. Thank you for your time.</p>
          </div>
        );
      default:
        return (
          <div className="rounded-2xl border border-[var(--ef-border)] bg-white p-6">
            <h1 className="text-lg font-semibold mb-2">This part isn't ready yet</h1>
            <p className="text-sm text-[var(--ef-muted)]">Session state: {snapshot.session.state}. Please check back soon.</p>
          </div>
        );
    }
  }

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <ProgressLabel state={snapshot.session.state} />
        {canWithdraw && (
          <button onClick={withdraw} disabled={withdrawing} className="text-xs text-[var(--ef-muted)] underline">
            {withdrawing ? "Stopping…" : "Stop"}
          </button>
        )}
      </div>
      {renderBody()}
    </PageShell>
  );
}
