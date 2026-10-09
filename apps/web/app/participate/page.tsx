"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, PageShell } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { SITUATION_CARDS, PILOT_LABEL_PATTERN } from "@/lib/zod/requests";
import { SITUATION_CARD_LABELS, DECISION_CUES } from "@/lib/decision-cues";

type Step = "consent" | "situation" | "goal" | "cue";

// useSearchParams() requires a Suspense boundary (it's what lets this page
// read ?pilot= without forcing the whole app into client-side-only
// rendering). The page is already fully client-interactive either way.
export default function ParticipatePage() {
  return (
    <Suspense fallback={null}>
      <ParticipateForm />
    </Suspense>
  );
}

function ParticipateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pilotParam = searchParams.get("pilot");
  const pilotLabel = pilotParam && PILOT_LABEL_PATTERN.test(pilotParam) ? pilotParam : null;
  const [step, setStep] = useState<Step>("consent");
  const [consented, setConsented] = useState(false);
  const [situationCard, setSituationCard] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [decisionCueId, setDecisionCueId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [showMoreCues, setShowMoreCues] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cues = situationCard ? DECISION_CUES[situationCard] ?? [] : [];
  const visibleCues = showMoreCues ? cues : cues.slice(0, 5);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentVersion: "v1",
          situationCard,
          goal: goal.trim() || null,
          // Both are preserved: a participant may pick a card AND type their
          // own story underneath it. Neither overwrites the other.
          decisionCueId: decisionCueId,
          freeText: freeText.trim() || null,
          pilotLabel,
        }),
      });
      if (!res.ok) throw new Error("request_failed");
      const data = await res.json();
      router.push(`/s/${data.sessionId}`);
    } catch {
      setError("Something went wrong starting your session. Please try again.");
      setSubmitting(false);
    }
  }

  if (step === "consent") {
    return (
      <PageShell>
        <Card className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">Before we start</h1>
          <ul className="list-disc pl-5 text-sm text-[var(--ef-muted)] flex flex-col gap-2">
            <li>This is an AI-assisted research prototype. Your answers are sent to our model provider to generate the next question.</li>
            <li>We record your typed answers, your confirmed statement, and your confidence scores.</li>
            <li>A researcher may review your session for this study.</li>
            <li>You can stop at any time; stopping cancels anything not yet delivered to you.</li>
            <li>This does not cover political, religious, identity, crisis, addiction-treatment, or individualized medical/legal/financial topics.</li>
            <li>This study is for adults only. You must be 18 or older to take part.</li>
          </ul>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-1 h-5 w-5"
            />
            I am 18 or older, and I understand and agree to continue.
          </label>
          <Button disabled={!consented} onClick={() => setStep("situation")}>
            Continue
          </Button>
        </Card>
      </PageShell>
    );
  }

  if (step === "situation") {
    return (
      <PageShell>
        <Card className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">Which sounds most like your situation right now?</h1>
          <div className="grid grid-cols-2 gap-3">
            {SITUATION_CARDS.map((card) => (
              <button
                key={card}
                onClick={() => {
                  setSituationCard(card);
                  setStep("goal");
                }}
                className="rounded-lg border border-[var(--ef-border)] bg-white px-4 py-3 text-left text-sm font-medium hover:bg-[var(--ef-accent-soft)] min-h-[48px]"
              >
                {SITUATION_CARD_LABELS[card]}
              </button>
            ))}
          </div>
        </Card>
      </PageShell>
    );
  }

  if (step === "goal") {
    return (
      <PageShell>
        <Card className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">One optional question</h1>
          <Field label="What goal or responsibility is taking most of your attention this month? (optional)" htmlFor="goal">
            <input id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} className={inputClassName} placeholder="You can leave this blank" />
          </Field>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep("situation")}>
              Back
            </Button>
            <Button onClick={() => setStep("cue")}>Continue</Button>
          </div>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Tell us about one decision from the past two weeks</h1>
        <p className="text-sm text-[var(--ef-muted)]">Pick whichever is closest, or start directly with your own words below.</p>
        <div className="flex flex-col gap-2">
          {visibleCues.map((cue) => (
            <button
              key={cue.id}
              onClick={() => setDecisionCueId(cue.id)}
              className={`rounded-lg border px-4 py-3 text-left text-sm min-h-[48px] ${
                decisionCueId === cue.id ? "border-[var(--ef-accent)] bg-[var(--ef-accent-soft)]" : "border-[var(--ef-border)] bg-white hover:bg-[var(--ef-accent-soft)]"
              }`}
            >
              {cue.label}
            </button>
          ))}
          {!showMoreCues && cues.length > 5 && (
            <button onClick={() => setShowMoreCues(true)} className="text-sm underline text-[var(--ef-muted)] self-start">
              More examples
            </button>
          )}
        </div>

        <Field label="Or describe it in your own words" htmlFor="freeText" hint="Optional if you picked an example above.">
          <textarea
            id="freeText"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={3}
            className={inputClassName}
            placeholder="e.g. I decided to..."
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setStep("goal")} disabled={submitting}>
            Back
          </Button>
          <Button
            onClick={() => submit()}
            disabled={submitting || (!decisionCueId && freeText.trim().length === 0)}
          >
            {submitting ? "Starting…" : "Start"}
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
