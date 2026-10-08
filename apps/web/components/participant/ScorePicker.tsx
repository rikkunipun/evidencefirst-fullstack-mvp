export function ScorePicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-6 sm:grid-cols-11 gap-2" role="radiogroup" aria-label="Confidence from 0 to 10">
      {Array.from({ length: 11 }, (_, i) => i).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={`rounded-lg border px-0 py-3 text-sm font-medium min-h-[44px] ${
            value === n ? "border-[var(--ef-accent)] bg-[var(--ef-accent)] text-white" : "border-[var(--ef-border)] bg-white"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
