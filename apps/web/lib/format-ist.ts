/** Admin-display-only formatting. The database always stays UTC; this never writes anything. */
const IST_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function formatIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${IST_FORMATTER.format(new Date(iso))} IST`;
}
