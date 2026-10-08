import { describe, expect, it } from "vitest";
import { computeFollowupDueAt, isFollowupDue } from "../../lib/followup";

describe("follow-up due date", () => {
  it("is exactly delivery time plus seven days", () => {
    const delivered = new Date("2026-10-08T12:00:00.000Z");
    const due = computeFollowupDueAt(delivered);
    expect(due.toISOString()).toBe("2026-10-15T12:00:00.000Z");
  });

  it("is not due before the due date", () => {
    const due = new Date("2026-10-15T12:00:00.000Z");
    expect(isFollowupDue(due, new Date("2026-10-14T23:59:59.000Z"))).toBe(false);
  });

  it("is due exactly at and after the due date", () => {
    const due = new Date("2026-10-15T12:00:00.000Z");
    expect(isFollowupDue(due, new Date("2026-10-15T12:00:00.000Z"))).toBe(true);
    expect(isFollowupDue(due, new Date("2026-10-16T00:00:00.000Z"))).toBe(true);
  });
});
