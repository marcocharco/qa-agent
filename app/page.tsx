import Link from "next/link";
import StatusIcon from "@/components/StatusIcon";
import { ago, chip } from "@/components/ui";
import { sortTrails, trailStatus, type TrailStatus } from "@/lib/overview";
import { listTrailCards } from "@/lib/queries";

const ui: Record<TrailStatus, { label: string; icon: "running" | "failed" | "proposed" | "passed" | "todo"; ring: string }> = {
  running: { label: "Running", icon: "running", ring: "border-accent/40" },
  failing: { label: "Failing", icon: "failed", ring: "border-fail/40" },
  review: { label: "Needs review", icon: "proposed", ring: "border-accent/30" },
  ready: { label: "Ready to merge", icon: "passed", ring: "border-pass/40" },
  idle: { label: "Not run yet", icon: "todo", ring: "border-line" },
  merged: { label: "Merged", icon: "passed", ring: "border-line" },
};

export default async function Home() {
  const trails = sortTrails(await listTrailCards());
  if (!trails.length) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-tight">No Trails yet</h1>
        <p className="mt-3 max-w-lg text-muted">
          Run the orchestrator on a Trail (<code className="font-mono text-sm">npx tsx --env-file=.env.local scripts/orchestrate.mts &lt;trail-number&gt;</code>)
          or load sample data with <code className="font-mono text-sm">scripts/seed-ui.mts</code>.
        </p>
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10">
      <h1 className="text-3xl font-semibold tracking-tight">Your Trails</h1>
      <p className="mt-1 text-muted">What needs you comes first.</p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {trails.map((t) => {
          const s = trailStatus(t);
          const u = ui[s];
          return (
            <li key={t.id}>
              <Link href={`/t/${t.id}`} className={`flex h-full flex-col gap-4 rounded-2xl border bg-background p-5 transition-colors hover:bg-panel ${u.ring} ${s === "merged" ? "opacity-70" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold"><StatusIcon state={u.icon} size={18} />{u.label}</span>
                  <span className={chip}>{t.state}{t.branch ? ` · ${t.branch}` : ""}</span>
                </div>
                <h2 className="text-lg font-semibold leading-snug tracking-tight">{t.title}{t.id.startsWith("sample-") && <span className={`${chip} ml-2 align-middle`}>sample data</span>}</h2>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  {t.failed > 0 && <span className="flex items-center gap-1.5 text-fail"><StatusIcon state="failed" size={14} />{t.failed}</span>}
                  {t.review > 0 && <span className="flex items-center gap-1.5 text-accent"><StatusIcon state="review" size={14} />{t.review}</span>}
                  {t.passed > 0 && <span className="flex items-center gap-1.5 text-pass"><StatusIcon state="passed" size={14} />{t.passed}</span>}
                  {t.toReview > 0 && <span className="flex items-center gap-1.5"><StatusIcon state="proposed" size={14} />{t.toReview} to review</span>}
                  <span>{t.requirements} requirements</span>
                  {t.lastRunAt && <span>run {ago(t.lastRunAt)}</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
