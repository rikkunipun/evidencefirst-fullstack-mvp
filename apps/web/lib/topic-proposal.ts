/**
 * Tier 2 item 9. A free-text-only story (no situation card) leaves
 * sessions.pack_topic permanently null, which makes the checkable gate
 * fail even when the story is clearly about something an evidence pack
 * covers — absence of a card reads as "no checkable evidence" regardless
 * of content. This proposes a catalog topic from the participant's own
 * words, which the server then asks about neutrally (never states it as
 * fact, never implies their story is wrong) — the participant has the
 * final say, and pack_topic is only ever set from an explicit "yes" to a
 * specific, real catalog key, never force-matched.
 *
 * Deliberately a plain keyword heuristic, not a model call — this is a
 * genuinely rough proposal, not a classification to trust on its own;
 * that's exactly why a neutral confirmation step, not a direct write,
 * follows it.
 */
export type TopicKey = "activity" | "study" | "learning";

export const TOPIC_LABELS: Record<TopicKey, string> = {
  activity: "general physical activity or exercise",
  study: "study methods or exam preparation",
  learning: "a course, skill, or way of learning something",
};

const KEYWORD_PATTERNS: { topic: TopicKey; pattern: RegExp }[] = [
  { topic: "activity", pattern: /\b(gym|walk(?:ing)?|exercis\w*|workout|fitness|run(?:ning)?|aerobic|jog\w*|sport)\b/i },
  { topic: "study", pattern: /\b(stud(?:y|ying|ied)|exam|test|biology|homework|revis\w*|practice questions?|rereading|flashcards?)\b/i },
  { topic: "learning", pattern: /\b(diagram|video tutorial|online course|skill|learn\w*|audio explanation)\b/i },
];

/** Returns the first matching catalog topic, or null if nothing matched —
 * never guesses when there's no signal. */
export function proposeTopicKey(participantText: string): TopicKey | null {
  for (const { topic, pattern } of KEYWORD_PATTERNS) {
    if (pattern.test(participantText)) return topic;
  }
  return null;
}

export function topicConfirmationQuestion(topic: TopicKey): string {
  return `Does your story sound like it's mainly about ${TOPIC_LABELS[topic]} — yes or no?`;
}

/** Conservative: anything that isn't a clear "yes" is treated as a
 * decline, never as an accidental match. */
export function interpretYesNo(answer: string): boolean {
  return /^\s*(y|yes|yeah|yep|yup)\b/i.test(answer.trim());
}
