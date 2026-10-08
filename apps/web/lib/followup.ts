const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Follow-up due time is exactly delivery-commitment time plus seven days. */
export function computeFollowupDueAt(deliveredAt: Date): Date {
  return new Date(deliveredAt.getTime() + SEVEN_DAYS_MS);
}

export function isFollowupDue(dueAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= dueAt.getTime();
}
