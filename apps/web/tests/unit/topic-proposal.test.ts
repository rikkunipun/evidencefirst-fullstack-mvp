import { describe, expect, it } from "vitest";
import { proposeTopicKey, topicConfirmationQuestion, interpretYesNo, TOPIC_LABELS } from "../../lib/topic-proposal";

describe("proposeTopicKey (Tier 2 item 9)", () => {
  it("proposes activity for a gym/exercise story", () => {
    expect(proposeTopicKey("Last Monday I chose the bus to a gym instead of brisk walking outside.")).toBe("activity");
  });

  it("proposes study for an exam/rereading story", () => {
    expect(proposeTopicKey("For last Friday's biology test I chose rereading instead of practice questions.")).toBe("study");
  });

  it("proposes learning for a diagrams/skill story", () => {
    expect(proposeTopicKey("I chose diagrams because I enjoy pictures and find them easier to learn from.")).toBe("learning");
  });

  it("proposes nothing when no keyword matches — never guesses without signal", () => {
    expect(proposeTopicKey("I decided to repaint the fence a different color.")).toBeNull();
  });
});

describe("topicConfirmationQuestion", () => {
  it("is neutral — states the label as a question, not a fact, for every catalog topic", () => {
    for (const topic of Object.keys(TOPIC_LABELS) as (keyof typeof TOPIC_LABELS)[]) {
      const q = topicConfirmationQuestion(topic);
      expect(q).toContain("?");
      expect(q.toLowerCase()).not.toContain("your story is about");
    }
  });
});

describe("interpretYesNo", () => {
  it("accepts clear yes answers", () => {
    expect(interpretYesNo("Yes")).toBe(true);
    expect(interpretYesNo("yeah that's right")).toBe(true);
  });

  it("treats anything else — including explicit no and ambiguous text — as a decline, never an accidental match", () => {
    expect(interpretYesNo("No")).toBe(false);
    expect(interpretYesNo("not really")).toBe(false);
    expect(interpretYesNo("maybe, I'm not sure")).toBe(false);
    expect(interpretYesNo("")).toBe(false);
  });
});
