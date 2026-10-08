import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--ef-border)] bg-[var(--ef-surface)] p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-[720px] flex flex-col gap-6">{children}</div>
    </main>
  );
}
