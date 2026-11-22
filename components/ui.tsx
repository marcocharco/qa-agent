import type { CheckStatus } from "@/lib/report";

export const btn = "inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40";
export const btnGhost = "inline-flex items-center justify-center rounded-full border border-line px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-chip disabled:opacity-40";
export const chip = "inline-flex items-center rounded-full bg-chip px-2.5 py-0.5 text-xs font-medium text-muted";
export const input = "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-foreground";

const tone: Record<CheckStatus, string> = {
  running: "bg-accent/10 text-accent",
  passed: "bg-pass/10 text-pass",
  failed: "bg-fail/10 text-fail",
  errored: "bg-chip text-muted",
  review: "bg-accent/10 text-accent",
};

export function StatusBadge({ status }: { status: CheckStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[status]}`}>
      {status === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {status === "review" ? "needs review" : status}
    </span>
  );
}

export const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export const seconds = (ms: number | null) => (ms == null ? "" : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`);
