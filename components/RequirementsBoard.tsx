"use client";

import { useMemo, useState, useTransition } from "react";
import { setMany } from "@/app/actions";
import { featureOrder } from "@/lib/overview";
import type { RequirementRow as Req } from "@/lib/queries";
import RequirementRow from "./RequirementRow";
import { btn, btnGhost, chip } from "./ui";

type Filter = "all" | "review" | "approved" | "rejected";

const HIGH = 0.85;

const matches: Record<Filter, (r: Req) => boolean> = {
  // What is live: asks waiting for review and asks that are approved. Rejected and replaced ones have their own tab.
  all: (r) => r.status === "proposed" || r.status === "approved",
  review: (r) => r.status === "proposed" && r.testable,
  approved: (r) => r.status === "approved",
  rejected: (r) => r.status === "rejected" || r.status === "superseded",
};

function Group({ title, rows, sel, toggle }: { title: string; rows: Req[]; sel: Set<string>; toggle: (id: string) => void }) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <span className={chip}>{rows.length}</span>
      </div>
      <ul className="mt-1 divide-y divide-line border-y border-line">
        {rows.map((r) => <RequirementRow key={r.id} r={r} select={{ checked: sel.has(r.id), onChange: () => toggle(r.id) }} />)}
      </ul>
    </section>
  );
}

/** Review the whole set at once: filter, select, approve in bulk. Per-row edit and drift review stay on each row. */
export default function RequirementsBoard({ fresh: all, regression: allRegression }: { fresh: Req[]; regression: Req[] }) {
  // An ask that cannot be tested is not a requirement the app can act on. It stays out of the list; the coverage card above still counts it. A proposed change to an earlier requirement always shows: it is a decision, not a test.
  const fresh = useMemo(() => all.filter((r) => r.testable || r.supersedes), [all]);
  const regression = useMemo(() => allRegression.filter((r) => r.testable), [allRegression]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [warning, setWarning] = useState<string | null>(null);

  const counts = useMemo(() => Object.fromEntries((Object.keys(matches) as Filter[]).map((f) => [f, fresh.filter(matches[f]).length])) as Record<Filter, number>, [fresh]);
  // Drift is never bulk approved: replacing an earlier requirement is a decision to read.
  const high = fresh.filter((r) => r.status === "proposed" && r.testable && r.confidence >= HIGH && !r.supersedes);
  const shown = fresh.filter(matches[filter]);
  const groups = useMemo(() => {
    const m = new Map<string, Req[]>();
    for (const r of shown) {
      // A proposed change to an earlier requirement is a decision to make, so it gets its own group (listed first).
      const key = r.supersedes ? "Changes to earlier requirements" : r.feature ?? "Other";
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    const order = featureOrder(fresh, regression);
    return [...m].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  }, [shown, fresh, regression]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const run = (ids: string[], status: "approved" | "rejected") => start(async () => { setWarning(await setMany(ids, status)); setSel(new Set()); });
  const tabs: [Filter, string][] = [["all", "All"], ["review", "To review"], ["approved", "Approved"], ["rejected", "Rejected"]];

  return (
    <div className={pending ? "opacity-60" : ""}>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter requirements" className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-panel p-1">
          {tabs.map(([f, label]) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${filter === f ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}>
              {label} <span className="opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {sel.size > 0 ? (
            <>
              <span className="text-sm text-muted">{sel.size} selected</span>
              <button className={btn} disabled={pending} onClick={() => run([...sel], "approved")}>Approve</button>
              <button className={btnGhost} disabled={pending} onClick={() => run([...sel], "rejected")}>Reject</button>
              <button className="text-sm text-muted hover:text-foreground" onClick={() => setSel(new Set())}>Clear</button>
            </>
          ) : high.length > 0 ? (
            <button className={btn} disabled={pending} onClick={() => run(high.map((r) => r.id), "approved")}>Approve {high.length} high-confidence {high.length === 1 ? "ask" : "asks"}</button>
          ) : null}
        </div>
      </div>
      {warning && <p className="mt-2 text-sm text-fail">{warning}</p>}

      {groups.map(([feature, rows]) => <Group key={feature} title={feature} rows={rows} sel={sel} toggle={toggle} />)}
      {!groups.length && <p className="mt-8 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">Nothing here.</p>}

      {regression.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer list-none">
            <span className="text-lg font-semibold tracking-tight">Regression</span> <span className={chip}>{regression.length}</span>
            <span className="ml-3 text-sm text-muted">Approved requirements from merged Trails. They run on every push. Click to show.</span>
          </summary>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {regression.map((r) => <RequirementRow key={r.id} r={r} showTrail />)}
          </ul>
        </details>
      )}
    </div>
  );
}
