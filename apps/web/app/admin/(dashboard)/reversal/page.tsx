"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Field";
import { apiPost } from "@/lib/api-client";

interface ReversalResult {
  runId: string;
  supported: boolean;
  matchedClaimIds: string[];
  refusalReceipt: { message: string; deliveredFactualClaims: number } | null;
}

export default function AdminReversalPage() {
  const [claim, setClaim] = useState("Walking outside a gym guarantees identical muscle growth and the same consistency as any gym programme.");
  const [packId, setPackId] = useState("");
  const [result, setResult] = useState<ReversalResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<ReversalResult>("/api/admin/reversal", { submittedClaim: claim.trim(), packId: packId || undefined });
      setResult(r);
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-lg font-semibold">Reversal QA</h1>
      <p className="text-sm text-[var(--ef-muted)]">
        Submit an assertion the active evidence packs should <em>not</em> support. The system searches only enabled evidence units for an exact match and
        refuses to produce a persuasive factual brief if none is found.
      </p>
      <Card className="flex flex-col gap-4">
        <textarea value={claim} onChange={(e) => setClaim(e.target.value)} rows={3} className={inputClassName} />
        <select value={packId} onChange={(e) => setPackId(e.target.value)} className={inputClassName}>
          <option value="">Search all enabled packs</option>
          <option value="activity">activity</option>
          <option value="study">study</option>
          <option value="learning">learning</option>
        </select>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button onClick={run} disabled={busy || !claim.trim()}>
          {busy ? "Running…" : "Run reversal test"}
        </Button>
      </Card>

      {result && (
        <Card className={result.supported ? "border-amber-300" : "border-green-300"}>
          <h2 className="font-semibold mb-2">{result.supported ? "Exact support found" : "Refused — no support found"}</h2>
          {result.refusalReceipt ? (
            <>
              <p className="text-sm">{result.refusalReceipt.message}</p>
              <p className="text-sm mt-1">
                Delivered factual claims: <span className="font-semibold">{result.refusalReceipt.deliveredFactualClaims}</span>
              </p>
            </>
          ) : (
            <p className="text-sm">Matched claim IDs: {result.matchedClaimIds.join(", ")}</p>
          )}
          <p className="text-xs text-[var(--ef-muted)] mt-2">Run ID {result.runId}</p>
        </Card>
      )}
    </div>
  );
}
