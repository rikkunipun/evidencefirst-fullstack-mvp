import { Card } from "@/components/ui/Card";

export default function AdminExportPage() {
  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <h1 className="text-lg font-semibold">Export</h1>
      <Card className="flex flex-col gap-3">
        <p className="text-sm text-[var(--ef-muted)]">
          De-identified by participant code (no names/emails stored to begin with). Omits transcripts and capability tokens.
        </p>
        <a className="text-sm underline text-[var(--ef-accent)]" href="/api/admin/export?format=csv">
          Download CSV
        </a>
        <a className="text-sm underline text-[var(--ef-accent)]" href="/api/admin/export?format=json">
          Download JSON
        </a>
      </Card>
    </div>
  );
}
