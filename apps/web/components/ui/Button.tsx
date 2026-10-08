import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-medium transition-colors min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--ef-accent)] text-[var(--ef-accent-ink)] hover:brightness-110",
  secondary: "bg-white text-[var(--ef-ink)] border border-[var(--ef-border)] hover:bg-[var(--ef-accent-soft)]",
  ghost: "bg-transparent text-[var(--ef-muted)] hover:text-[var(--ef-ink)] underline underline-offset-2",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
