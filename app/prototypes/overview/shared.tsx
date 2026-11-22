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
  const names = live.checks.filter((c) => c.status === "running" && c.streamingUrl === (running ?? sample)?.streamingUrl).map((c) => c.requirement);
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
