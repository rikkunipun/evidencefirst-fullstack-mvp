import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--ef-ink)]">
        {label}
      </label>
      {hint && <p className="text-sm text-[var(--ef-muted)]">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClassName =
  "w-full rounded-lg border border-[var(--ef-border)] bg-white px-4 py-3 text-base text-[var(--ef-ink)] placeholder:text-[var(--ef-muted)] focus-visible:border-[var(--ef-accent)]";
