import { Card } from "@/components/ui/Card";

export function WaitingView() {
  return (
    <Card className="flex flex-col gap-3">
      <h1 className="text-lg font-semibold">Thanks — we're reviewing your case</h1>
      <p className="text-sm text-[var(--ef-muted)]">
        A researcher checks every response against our sources before it's shown to anyone. This usually doesn't take long. You can close this page and
        come back later — your progress is saved.
      </p>
    </Card>
  );
}
