"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CheckRow, Live } from "@/lib/queries";
import RunNow from "./RunNow";
import { StatusBadge, ago, seconds } from "./ui";

type Job = { running: boolean; exitCode: number | null; log: string[] } | null;

/** Checks of one feature share one browser session and one stream, so they share one tile. */
function groupSessions(checks: CheckRow[]): CheckRow[][] {
  const groups = new Map<string, CheckRow[]>();
  for (const c of checks) {
    const key = c.streamingUrl ?? c.id;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.values()];
}

function SessionTile({ cs, trailId }: { cs: CheckRow[]; trailId: string }) {
  const url = cs[0].streamingUrl;
  const live = url?.startsWith("http");
  const running = cs.some((c) => c.status === "running");
  const anyFailed = cs.some((c) => c.status === "failed");
  return (
    <li className={`flex flex-col overflow-hidden rounded-2xl border bg-background ${anyFailed ? "border-fail/40" : "border-line"}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted">
        <span>One browser session, {cs.length} {cs.length === 1 ? "check" : "checks"}</span>
        {live && <a className="font-medium text-accent hover:underline" href={url!} target="_blank" rel="noreferrer">Watch live ↗</a>}
      </div>
      {running &&
        (live ? (
          <iframe src={url!} title="Live browser" allow="clipboard-read; clipboard-write" className="aspect-video w-full border-y border-line bg-panel" />
        ) : (
          <div className="flex aspect-video items-center justify-center border-y border-line bg-panel text-sm text-muted">
            {url ? "Live browser (sample)" : "Starting browser..."}
          </div>
        ))}
      <ul className="divide-y divide-line">
        {cs.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium leading-snug">{c.requirement}</p>
              <StatusBadge status={c.status} />
            </div>
            {c.status !== "running" && (
              <>
                <p className="text-sm leading-relaxed text-muted">{c.reason ?? "No details."}</p>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{seconds(c.durationMs)}</span>
                  {c.status === "failed" && <Link className="font-medium text-accent hover:underline" href={`/t/${trailId}/checks/${c.id}`}>Bug report →</Link>}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function LiveGrid({ trailId, initial }: { trailId: string; initial: Live }) {
  const [live, setLive] = useState(initial);
  const [job, setJob] = useState<Job>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const d = await (await fetch(`/api/trails/${trailId}/live`, { cache: "no-store" })).json();
        if (!stop) { setLive(d.live); setJob(d.job); }
      } catch { /* the next tick retries */ }
    };
    const t = setInterval(tick, 2000);
    void tick();
    return () => { stop = true; clearInterval(t); };
  }, [trailId]);

  const { run, checks } = live;
  const n = (s: CheckRow["status"]) => checks.filter((c) => c.status === s).length;
  const done = checks.length - n("running");
  const starting = job?.running && (!run || run.finishedAt);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {!run ? "No runs yet" : run.finishedAt ? "Latest run finished" : "Run in progress"}
          </h2>
          {run && <p className="mt-1 text-sm text-muted">Commit <span className="font-mono">{run.headSha.slice(0, 7)}</span> · started {ago(run.startedAt)}</p>}
        </div>
        <div className="flex items-center gap-4">
          {run && <Link href={`/t/${trailId}/history`} className="text-sm text-muted hover:text-foreground">Previous runs</Link>}
          <RunNow trailId={trailId} goToRun={false} label={run ? "Run again" : "Run now"} />
        </div>
      </div>

      {starting && (
        <p className="mt-4 rounded-xl bg-panel px-4 py-3 text-sm text-muted">
          <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Orchestrator started: {job?.log.at(-1) ?? "syncing the Trail and extracting requirements..."}
        </p>
      )}
      {job && !job.running && job.exitCode !== 0 && (
        <p className="mt-4 rounded-xl bg-fail/10 px-4 py-3 text-sm text-fail">The orchestrator exited with code {job.exitCode}: {job.log.at(-1)}</p>
      )}

      {!run && !job?.running && (
        <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          This Trail has not been run yet. Approve its requirements, then press Run now. Each requirement gets its own live browser here.
        </p>
      )}
      {run && !run.finishedAt && checks.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Compiling requirements into browser goals. Tiles appear as each browser starts.</p>
      )}

      {run && checks.length > 0 && (
        <div className="mt-6">
          <div className="flex h-2 overflow-hidden rounded-full bg-chip">
            <div className="bg-pass transition-all" style={{ width: `${(n("passed") / checks.length) * 100}%` }} />
            <div className="bg-fail transition-all" style={{ width: `${(n("failed") / checks.length) * 100}%` }} />
            <div className="bg-accent/60 transition-all" style={{ width: `${(n("review") / checks.length) * 100}%` }} />
            <div className="bg-muted/50 transition-all" style={{ width: `${(n("errored") / checks.length) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {done} of {checks.length} done · <span className="text-pass">{n("passed")} passed</span> · <span className="text-fail">{n("failed")} failed</span> · {n("review")} need review · {n("errored")} errored · {n("running")} running
          </p>
        </div>
      )}

      {checks.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {groupSessions(checks).map((cs) => <SessionTile key={cs[0].streamingUrl ?? cs[0].id} cs={cs} trailId={trailId} />)}
        </ul>
      )}
    </>
  );
}
