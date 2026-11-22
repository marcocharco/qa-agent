"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { setStatus } from "@/app/actions";
import RunNow from "@/components/RunNow";
import { StatusBadge, ago, btn, btnGhost, chip } from "@/components/ui";
import { recommend } from "@/lib/recommendation";
import type { CheckRow, Live, RequirementRow } from "@/lib/queries";
import type { Data } from "./types";

export type Lane = "proposed" | "ready" | "running" | "passed" | "attention";
export type Card = { req: RequirementRow; regression: boolean; check: CheckRow | null; lane: Lane };

export const LANES: { id: Lane; title: string; hint: string }[] = [
  { id: "proposed", title: "To review", hint: "Asks found in the chat, waiting for you" },
  { id: "ready", title: "Ready", hint: "Approved, will run on the next push" },
  { id: "running", title: "Running", hint: "A browser is testing it now" },
  { id: "passed", title: "Passing", hint: "Confirmed on the live site" },
  { id: "attention", title: "Needs you", hint: "Failed, flaky or no verdict" },
];

/** Poll the same endpoint the live page uses, so every variant shows a run as it happens. */
export function useLive(trailId: string, initial: Live): Live {
  const [live, setLive] = useState(initial);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const d = await (await fetch(`/api/trails/${trailId}/live`, { cache: "no-store" })).json();
        if (!stop) setLive(d.live);
      } catch { /* next tick retries */ }
    };
    const t = setInterval(tick, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [trailId]);
  return live;
}

export function buildCards(data: Data, live: Live): Card[] {
  const byReq = new Map(live.checks.map((c) => [c.requirementId, c]));
  const mine = data.fresh.filter((r) => r.testable && (r.status === "proposed" || r.status === "approved"));
  return [...mine.map((r) => ({ r, regression: false })), ...data.regression.map((r) => ({ r, regression: true }))].map(({ r, regression }) => {
    const check = byReq.get(r.id) ?? null;
    const s = check?.status;
    const lane: Lane =
      s === "running" ? "running" : s === "passed" ? "passed" : s === "failed" || s === "review" || s === "errored" ? "attention"
      : r.status === "proposed" ? "proposed" : "ready";
    return { req: r, regression, check, lane };
  });
}

export function summarize(cards: Card[]) {
  const n = (l: Lane) => cards.filter((c) => c.lane === l).length;
  const failed = cards.filter((c) => c.check?.status === "failed");
  const total = cards.filter((c) => c.check).length;
  return {
    total, passed: n("passed"), failed: failed.length, running: n("running"), proposed: n("proposed"), ready: n("ready"),
    review: cards.filter((c) => c.check?.status === "review").length, errored: cards.filter((c) => c.check?.status === "errored").length,
    failures: failed.map((c) => ({ text: c.req.text, reason: c.check?.reason ?? "" })),
  };
}

export const verdictOf = (cards: Card[]) => {
  const s = summarize(cards);
  return recommend({ total: s.total, passed: s.passed, failed: s.failed, needsReview: s.review, errored: s.errored, failures: s.failures });
};

export const verdictTone = { merge: "text-pass", review: "text-accent", hold: "text-fail" } as const;

export function TopBar({ data, live, right }: { data: Data; live: Live; right?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={chip}>{data.trail.state}{data.trail.branch ? ` · ${data.trail.branch}` : ""}</span>
          {live.run && <span className="text-xs text-muted">last run {ago(live.run.startedAt)}</span>}
        </div>
        <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{data.trail.title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {right}
        <Link className={btnGhost} href={`/t/${data.trailId}/history`}>History</Link>
        <RunNow trailId={data.trailId} goToRun={false} />
      </div>
    </header>
  );
}

/** The live TinyFish browser, or a quiet placeholder when nothing is running. */
export function LiveBrowser({ live, className = "" }: { live: Live; className?: string }) {
  const running = live.checks.find((c) => c.status === "running" && c.streamingUrl?.startsWith("http"));
  const sample = live.checks.find((c) => c.status === "running" && c.streamingUrl);
  const names = live.checks.filter((c) => c.status === "running" && c.streamingUrl === (running ?? sample)?.streamingUrl).map((c) => shortLabel(c.requirement, 40));
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-panel ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line bg-background px-4 py-2.5 text-xs text-muted">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${running || sample ? "animate-pulse bg-accent" : "bg-muted/40"}`} />
          {running || sample ? "Live browser" : "No browser running"}
        </span>
        {running && <a className="font-medium text-accent hover:underline" href={running.streamingUrl!} target="_blank" rel="noreferrer">Watch live ↗</a>}
      </div>
      {running ? (
        <iframe src={running.streamingUrl!} title="Live browser" className="min-h-0 w-full flex-1 bg-panel" />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-muted">
          {sample ? "Live browser (sample data has no stream)" : live.run ? `Last run finished ${ago(live.run.finishedAt ?? live.run.startedAt)}. Press Run now to watch the agent test the site.` : "Press Run now to watch an agent test the site."}
        </div>
      )}
      {names.length > 0 && <p className="border-t border-line bg-background px-4 py-2 text-xs text-muted">Testing: {names.join(" · ")}</p>}
    </div>
  );
}

export function ReqActions({ r, compact = false }: { r: RequirementRow; compact?: boolean }) {
  const [pending, start] = useTransition();
  const cls = compact ? "rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-chip disabled:opacity-40" : btnGhost;
  return (
    <div className="flex gap-2">
      {r.status === "proposed" && (
        <button className={cls} disabled={pending} onClick={() => start(() => void setStatus(r.id, "approved"))}>{r.supersedes ? "Approve change" : "Approve"}</button>
      )}
      {r.status !== "rejected" && (
        <button className={cls} disabled={pending} onClick={() => start(() => void setStatus(r.id, "rejected"))}>Reject</button>
      )}
    </div>
  );
}

export const Badge = StatusBadge;
export { btn, btnGhost, chip };

/** A short label for a long requirement sentence: the first clause, trimmed. A real title column replaces this. */
export function shortLabel(text: string, max = 46): string {
  const clause = text.split(/[:.]\s/)[0].replace(/^(The|A|An)\s+/i, "");
  const t = clause.length > max ? clause.slice(0, max).replace(/\s+\S*$/, "") + "..." : clause;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function groupByFeature(cards: Card[]): { feature: string; cards: Card[] }[] {
  const m = new Map<string, Card[]>();
  for (const c of cards) m.set(c.req.feature ?? "Other", [...(m.get(c.req.feature ?? "Other") ?? []), c]);
  return [...m].map(([feature, cs]) => ({ feature, cards: cs }));
}

/** idle: never ran. running: a run is open. done: the last run finished. */
export function phaseOf(live: Live): "idle" | "running" | "done" {
  if (!live.run) return "idle";
  return live.run.finishedAt ? "done" : "running";
}

/** One plain sentence on what is happening, so the page always answers "what am I looking at". */
export function nowLine(cards: Card[], live: Live): string {
  const phase = phaseOf(live);
  const s = summarize(cards);
  if (phase === "idle") return `Nothing has run yet. ${cards.length} requirements are ready to test.`;
  if (phase === "running") {
    const r = cards.find((c) => c.lane === "running");
    const done = cards.filter((c) => c.check && c.lane !== "running").length;
    return r ? `Testing "${shortLabel(r.req.text, 40)}" · ${done} of ${live.checks.length} checks done` : `Running · ${live.checks.length} checks started`;
  }
  const v = verdictOf(cards);
  return v.verdict === "hold" ? `${s.failed} ${s.failed === 1 ? "requirement fails" : "requirements fail"}. Hold the merge.` : v.verdict === "review" ? "Nothing is broken, but some results need a look." : "Everything passes. Safe to merge.";
}

/** Splits "what happened. Saw: <observed text>" as the orchestrator writes it. */
export function splitReason(reason: string | null): { claim: string; saw: string | null } {
  if (!reason) return { claim: "", saw: null };
  const i = reason.indexOf(" Saw: ");
  return i < 0 ? { claim: reason, saw: null } : { claim: reason.slice(0, i), saw: reason.slice(i + 6) };
}

export const laneDot: Record<Lane, string> = { proposed: "bg-accent", ready: "bg-muted/40", running: "bg-accent animate-pulse", passed: "bg-pass", attention: "bg-fail" };

/** Results, worst first: what happened and what the page showed, details folded away. */
export function ResultList({ cards, trailId }: { cards: Card[]; trailId: string }) {
  const failed = cards.filter((c) => c.check?.status === "failed");
  const review = cards.filter((c) => c.check?.status === "review" || c.check?.status === "errored");
  const passed = cards.filter((c) => c.check?.status === "passed");
  const row = (c: Card) => {
    const { claim, saw } = splitReason(c.check?.reason ?? null);
    return (
      <li key={c.req.id} className="rounded-2xl border border-line bg-background p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium leading-snug">{shortLabel(c.req.text, 70)}</p>
          {c.check && <StatusBadge status={c.check.status} />}
        </div>
        {claim && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{claim}</p>}
        {saw && <p className="mt-2 rounded-lg bg-panel px-3 py-2 font-mono text-xs leading-relaxed text-muted">Saw: {saw}</p>}
        <div className="mt-3 flex items-center gap-4">
          {c.check?.status === "failed" && <Link className="text-sm font-medium text-accent hover:underline" href={`/t/${trailId}/checks/${c.check.id}`}>Bug report →</Link>}
          <details className="text-xs text-muted"><summary className="cursor-pointer">Full requirement</summary><p className="mt-1 max-w-prose">{c.req.text}</p></details>
        </div>
      </li>
    );
  };
  return (
    <div className="space-y-6">
      {failed.length > 0 && <section><h3 className="mb-2 text-sm font-semibold text-fail">Failed · {failed.length}</h3><ul className="space-y-3">{failed.map(row)}</ul></section>}
      {review.length > 0 && <section><h3 className="mb-2 text-sm font-semibold text-accent">Needs a look · {review.length}</h3><ul className="space-y-3">{review.map(row)}</ul></section>}
      {passed.length > 0 && (
        <details className="rounded-2xl border border-line px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-pass">Passed · {passed.length}</summary>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">{passed.map((c) => <li key={c.req.id}>✓ {shortLabel(c.req.text, 80)}</li>)}</ul>
        </details>
      )}
      {!failed.length && !review.length && !passed.length && <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">No results yet. Press Run now.</p>}
    </div>
  );
}
