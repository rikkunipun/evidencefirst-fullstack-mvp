import Link from "next/link";

export function AdminNav({ email }: { email: string }) {
  return (
    <header className="border-b border-[var(--ef-border)] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link href="/admin">Queue</Link>
          <Link href="/admin/evidence">Evidence</Link>
          <Link href="/admin/reversal">Reversal QA</Link>
          <Link href="/admin/export">Export</Link>
        </nav>
        <span className="text-sm text-[var(--ef-muted)]">{email}</span>
      </div>
    </header>
  );
}
