/**
 * Neutral recent-decision examples shown per situation card. Each cue may
 * carry a `topicKey` that matches an evidence pack's `topics` entry
 * (see lib/evidence.ts) — this is informational context only, never
 * eligibility or evidence authorization on its own (brief §3).
 */
export interface DecisionCue {
  id: string;
  label: string;
  topicKey: string | null;
}

export const SITUATION_CARD_LABELS: Record<string, string> = {
  school: "School",
  college: "College",
  work: "Work",
  job_search: "Job search",
  household: "Household",
  business: "Business",
  retirement: "Retirement",
  other: "Something else",
  skip: "Prefer not to say",
};

const studyCues: DecisionCue[] = [
  { id: "test_prep", label: "How I prepared for a recent test", topicKey: "study" },
  { id: "study_time", label: "How I used study time", topicKey: "study" },
  { id: "course_skill", label: "A course or skill I tried or skipped", topicKey: "skills" },
  { id: "learning_format", label: "How I like to learn something new", topicKey: "learning" },
  { id: "activity_fit", label: "An activity I fitted into my week", topicKey: "activity" },
  { id: "purchase", label: "A purchase I considered", topicKey: null },
];

const workCues: DecisionCue[] = [
  { id: "course_skill", label: "A course or skill I tried or skipped", topicKey: "skills" },
  { id: "work_choice", label: "A work or commute decision", topicKey: null },
  { id: "activity_fit", label: "An activity I fitted into my week", topicKey: "activity" },
  { id: "purchase", label: "A purchase I considered", topicKey: null },
];

const householdCues: DecisionCue[] = [
  { id: "child_study", label: "How a child in my household studies or prepares", topicKey: "childStudy" },
  { id: "household_choice", label: "A household or family decision", topicKey: null },
  { id: "activity_fit", label: "An activity I fitted into my week", topicKey: "activity" },
  { id: "purchase", label: "A purchase I considered", topicKey: null },
];

const genericCues: DecisionCue[] = [
  { id: "routine_choice", label: "A health or daily-routine decision", topicKey: null },
  { id: "activity_fit", label: "An activity I fitted into my week", topicKey: "activity" },
  { id: "purchase", label: "A purchase I considered", topicKey: null },
  { id: "something_else", label: "Something else", topicKey: null },
];

export const DECISION_CUES: Record<string, DecisionCue[]> = {
  school: studyCues,
  college: studyCues,
  work: workCues,
  job_search: workCues,
  household: householdCues,
  business: genericCues,
  retirement: genericCues,
  other: [{ id: "something_else", label: "Something else", topicKey: null }],
  skip: [{ id: "something_else", label: "Something else", topicKey: null }],
};

export function resolveTopicKey(situationCard: string, decisionCueId: string | null | undefined): string | null {
  if (!decisionCueId) return null;
  const cues = DECISION_CUES[situationCard] ?? [];
  return cues.find((c) => c.id === decisionCueId)?.topicKey ?? null;
}
