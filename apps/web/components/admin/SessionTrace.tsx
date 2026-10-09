"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { apiGet, apiPost } from "@/lib/api-client";
import type { SessionSnapshot } from "@/lib/types/session";

interface AuditEvent {
  actor_type: string;
  actor_id: string | null;
  action: string;
  before: unknown;
  after: unknown;
  created_at: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ef-muted)] mb-3">{title}</h2>
      {children}
    </Card>
  );
}

function GateRow({ label, status, reason }: { label: string; status: string; reason: string }) {
  const color = status === "pass" ? "text-green-700" : status === "fail" ? "text-red-700" : "text-amber-700";
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <div className="flex justify-between">
        <span className="font-medium">{label}</span>
        <span className={`font-semibold ${color}`}>{status}</span>
      </div>
      <p className="text-[var(--ef-muted)]">{reason}</p>
    </div>
  );
}

export function SessionTrace({ sessionId, snapshot: initial, auditEvents: initialAudit }: { sessionId: string; snapshot: SessionSnapshot; auditEvents: AuditEvent[] }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [auditEvents, setAuditEvents] = useState(initialAudit);
  const [sourceMap, setSourceMap] = useState<{ claimId: string; text: string; sourceTitle: string; url: string }[] | null>(null);
  // No default for either — a researcher must explicitly choose both; an
  // omitted choice fails server validation rather than silently acting as
  // "Supported".
  const [briefAccurate, setBriefAccurate] = useState<"yes" | "no" | "">("");
  const [evidenceRelation, setEvidenceRelation] = useState<"supports" | "qualifies" | "contradicts" | "unresolved" | "outside_scope" | "">("");
  const [scopeJustification, setScopeJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const latest = await apiGet<SessionSnapshot & { auditEvents: AuditEvent[] }>(`/api/admin/sessions/${sessionId}`);
    setSnapshot(latest);
    setAuditEvents(latest.auditEvents);
  }

  async function generateDraft() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ sourceMap: typeof sourceMap }>(`/api/admin/sessions/${sessionId}/draft`, {});
      setSourceMap(result.sourceMap);
      await refresh();
    } catch {
      setError("Failed to generate draft.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!snapshot.draft || briefAccurate === "" || evidenceRelation === "") return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/admin/sessions/${sessionId}/approve`, {
        draftRevisionId: snapshot.draft.id,
        briefAccurate: briefAccurate === "yes",
        evidenceRelation,
        scopeJustification,
        contentHash: snapshot.draft.contentHash,
      });
      setBriefAccurate("");
      setEvidenceRelation("");
      await refresh();
    } catch (err) {
      // A double-click (or two reviewers racing) can lose to the single
      // insert that's actually allowed to succeed — that's not a failure,
      // it just means the session is already approved. Refresh instead
      // of showing an error.
      if (err instanceof Error && (err as Error & { status?: number }).status === 409) {
        await refresh();
      } else {
        setError("Failed to record approval.");
      }
    } finally {
      setBusy(false);
    }
  }

  const belief = snapshot.beliefConfirmation;

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Session {sessionId.slice(0, 8)}</h1>
        <span className="text-sm font-medium text-[var(--ef-accent)]">{snapshot.session.state}</span>
      </div>

      <Section title="1. Transcript">
        <ul className="flex flex-col gap-2 text-sm max-h-80 overflow-y-auto">
          {snapshot.messages.map((m) => (
            <li key={m.id}>
              <span className="font-medium">{m.role === "participant" ? "Participant" : "System"}:</span> {m.content}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="2. Extracted fields">
        <pre className="text-xs overflow-x-auto bg-[var(--ef-accent-soft)] p-3 rounded-lg">{JSON.stringify(snapshot.latestExtraction?.fields ?? {}, null, 2)}</pre>
      </Section>

      <Section title="3. Belief confirmation">
        <p className="text-sm">
          <span className="font-medium">Generated:</span> {belief?.generatedWording}
        </p>
        <p className="text-sm mt-1">
          <span className="font-medium">Confirmed:</span> {belief?.confirmedWording ?? "—"}
        </p>
      </Section>

      <Section title="4. Eligibility">
        {snapshot.eligibility ? (
          <div className="flex flex-col gap-3">
            <GateRow label="Current" status={snapshot.eligibility.current} reason={snapshot.eligibility.reasons.current} />
            <GateRow label="Specific" status={snapshot.eligibility.specific} reason={snapshot.eligibility.reasons.specific} />
            <GateRow label="Causal" status={snapshot.eligibility.causal} reason={snapshot.eligibility.reasons.causal} />
            <GateRow label="Consequential" status={snapshot.eligibility.consequential} reason={snapshot.eligibility.reasons.consequential} />
            <GateRow label="Checkable" status={snapshot.eligibility.checkable} reason={snapshot.eligibility.reasons.checkable} />
            <GateRow label="Safe / in scope" status={snapshot.eligibility.safe} reason={snapshot.eligibility.reasons.safe} />
          </div>
        ) : (
          <p className="text-sm text-[var(--ef-muted)]">Not yet evaluated.</p>
        )}
      </Section>

      <Section title="5. Baseline snapshot">
        {snapshot.baseline ? (
          <p className="text-sm">
            Score <span className="font-semibold">{snapshot.baseline.baselineScore}</span>/10 — scope: {snapshot.baseline.scopeAndTime}
          </p>
        ) : (
          <p className="text-sm text-[var(--ef-muted)]">Not frozen yet.</p>
        )}
      </Section>

      <Section title="6. Crux">
        <ul className="flex flex-col gap-2 text-sm">
          {snapshot.cruxPasses.map((p) => (
            <li key={p.passNumber}>
              Pass {p.passNumber}: &ldquo;{p.confirmedReason ?? p.statedReason}&rdquo; → hypothetical {p.hypotheticalScore ?? "—"}
            </li>
          ))}
        </ul>
        {snapshot.cruxClassification && <p className="text-sm mt-2 font-medium">Classification: {snapshot.cruxClassification}</p>}
      </Section>

      <Section title="7. Assigned condition">
        <p className="text-sm">{snapshot.assignment ? `${snapshot.assignment.condition} — ${snapshot.assignment.packId} v${snapshot.assignment.packVersion}` : "Not assigned."}</p>
      </Section>

      <Section title="8. Draft and claim-to-source map">
        {snapshot.session.state === "assigned" && (
          <Button onClick={generateDraft} disabled={busy}>
            {busy ? "Generating…" : "Generate draft"}
          </Button>
        )}
        {snapshot.draft && (
          <div className="flex flex-col gap-3 mt-3">
            <pre className="text-sm whitespace-pre-wrap bg-[var(--ef-accent-soft)] p-3 rounded-lg">{snapshot.draft.renderedText}</pre>
            <p className="text-xs text-[var(--ef-muted)]">{snapshot.draft.wordCount} words · hash {snapshot.draft.contentHash.slice(0, 12)}…</p>
            {sourceMap && (
              <ul className="text-xs flex flex-col gap-1">
                {sourceMap.map((s) => (
                  <li key={s.claimId}>
                    <span className="font-mono">{s.claimId}</span> → {s.sourceTitle}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {snapshot.session.state === "pending_review" && snapshot.draft && (
        <Section title="9. Researcher approval">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="briefAccurate">
              Is this brief accurate and in scope?
            </label>
            <select id="briefAccurate" value={briefAccurate} onChange={(e) => setBriefAccurate(e.target.value as typeof briefAccurate)} className={inputClassName}>
              <option value="" disabled>
                — select —
              </option>
              <option value="yes">Yes, accurate and in scope</option>
              <option value="no">No — needs revision</option>
            </select>

            <label className="text-sm font-medium" htmlFor="evidenceRelation">
              How does the evidence relate to the participant&apos;s specific claim?
            </label>
            <select id="evidenceRelation" value={evidenceRelation} onChange={(e) => setEvidenceRelation(e.target.value as typeof evidenceRelation)} className={inputClassName}>
              <option value="" disabled>
                — select —
              </option>
              <option value="supports">Supports it</option>
              <option value="qualifies">Qualifies it (supported with caveats)</option>
              <option value="contradicts">Contradicts it</option>
              <option value="unresolved">Unresolved — more work needed</option>
              <option value="outside_scope">Outside scope — evidence doesn&apos;t cover this claim</option>
            </select>
            {(briefAccurate === "no" || evidenceRelation === "unresolved") && (
              <p className="text-xs text-amber-700">This will return the session to &quot;assigned&quot; for a revised draft — not a terminal refusal.</p>
            )}
            {evidenceRelation === "outside_scope" && <p className="text-xs text-red-700">This will terminally refuse the session — the evidence pack doesn&apos;t cover this claim.</p>}
            <textarea
              value={scopeJustification}
              onChange={(e) => setScopeJustification(e.target.value)}
              rows={2}
              className={inputClassName}
              placeholder="Scope justification (required)"
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button onClick={approve} disabled={busy || !scopeJustification.trim() || briefAccurate === "" || evidenceRelation === ""}>
              {busy ? "Recording…" : "Record decision"}
            </Button>
          </div>
        </Section>
      )}

      <Section title="10. Delivery">
        {snapshot.delivery ? (
          <pre className="text-sm whitespace-pre-wrap bg-[var(--ef-accent-soft)] p-3 rounded-lg">{snapshot.delivery.exactText}</pre>
        ) : (
          <p className="text-sm text-[var(--ef-muted)]">Not delivered yet.</p>
        )}
      </Section>

      <Section title="11. Measurements">
        <ul className="text-sm flex flex-col gap-1">
          {snapshot.measurements.map((m) => (
            <li key={m.phase}>
              {m.phase}: {m.score}/10
            </li>
          ))}
          {snapshot.measurements.length === 0 && <li className="text-[var(--ef-muted)]">None recorded yet.</li>}
        </ul>
      </Section>

      <Section title="Audit log">
        <ul className="text-xs flex flex-col gap-1 max-h-60 overflow-y-auto">
          {auditEvents.map((a, i) => (
            <li key={i}>
              {new Date(a.created_at).toLocaleString()} — [{a.actor_type}{a.actor_id ? `:${a.actor_id}` : ""}] {a.action}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
