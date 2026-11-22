"use client";

import { ago, seconds } from "./ui";

type Run = { id: string; headSha: string; startedAt: string; durationMs: number | null; passed: number; failed: number; errored: number };

const rate = (r: Run) => { const t = r.passed + r.failed + r.errored; return t ? r.passed / t : 0; };

/** One bar per finished run, oldest to newest, bar height is the pass rate. Hover a bar for the run's numbers. */
export default function PassRateChart({ runs }: { runs: Run[] }) {
  const done = runs.filter((r) => r.durationMs != null).reverse();
  if (done.length < 2) return null;
  return (
    <div className="mb-8 rounded-2xl border border-line p-6">
      <h2 className="text-sm font-semibold text-muted">Pass rate per run</h2>
      <div className="mt-6 flex h-28 items-end gap-2" role="list" aria-label="Pass rate per run, oldest to newest">
        {done.map((r) => (
          <div key={r.id} role="listitem" tabIndex={0} className="group relative flex h-full max-w-12 flex-1 cursor-default flex-col justify-end outline-none">
            <div className={`rounded-t transition-[filter,transform] duration-150 group-hover:brightness-90 group-focus-visible:brightness-90 ${r.failed + r.errored ? "bg-accent" : "bg-pass"}`} style={{ height: `${Math.max(rate(r) * 100, 3)}%` }} />
            <span className="mt-1 text-center font-mono text-[10px] text-muted group-hover:text-foreground">{r.headSha.slice(0, 4)}</span>
            <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-xl border border-line bg-background p-3 text-xs opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              <p className="text-sm font-semibold">{Math.round(rate(r) * 100)}% passed</p>
              <p className="mt-0.5 text-muted"><span className="font-mono">{r.headSha.slice(0, 7)}</span> · {ago(r.startedAt)}</p>
              <p className="mt-2 flex gap-3 whitespace-nowrap">
                <span className="text-pass">{r.passed} passed</span>
                <span className={r.failed ? "text-fail" : "text-muted"}>{r.failed} failed</span>
                {r.errored > 0 && <span className="text-muted">{r.errored} errored</span>}
              </p>
              <p className="mt-1 text-muted">Ran for {seconds(r.durationMs) || "n/a"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
