"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CheckRow, Live } from "@/lib/queries";
import RunNow from "./RunNow";
import { StatusBadge, ago, seconds } from "./ui";

type Job = { running: boolean; exitCode: number | null; log: string[] } | null;

function Tile({ c, trailId }: { c: CheckRow; trailId: string }) {
  const live = c.streamingUrl?.startsWith("http");
  return (
    <li className={`flex flex-col overflow-hidden rounded-2xl border bg-background ${c.status === "failed" ? "border-fail/40" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{c.requirement}</p>
        <StatusBadge status={c.status} />
      </div>
      {c.status === "running" ? (
        live ? (
          <iframe src={c.streamingUrl!} title={c.requirement} className="aspect-video w-full border-t border-line bg-panel" />
        ) : (
          <div className="flex aspect-video items-center justify-center border-t border-line bg-panel text-sm text-muted">
            {c.streamingUrl ? "Live browser (sample)" : "Starting browser..."}
          </div>
        )
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-3 border-t border-line bg-panel px-4 py-4">
          <p className="text-sm leading-relaxed text-muted">{c.reason ?? "No details."}</p>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{seconds(c.durationMs)}</span>
            {c.status === "failed" && <Link className="font-medium text-accent hover:underline" href={`/t/${trailId}/checks/${c.id}`}>Bug report →</Link>}
          </div>
        </div>
      )}
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
        <RunNow trailId={trailId} goToRun={false} label={run ? "Run again" : "Run now"} />
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

      {run && checks.length > 0 && (
        <div className="mt-6">
          <div className="flex h-2 overflow-hidden rounded-full bg-chip">
            <div className="bg-pass transition-all" style={{ width: `${(n("passed") / checks.length) * 100}%` }} />
            <div className="bg-fail transition-all" style={{ width: `${(n("failed") / checks.length) * 100}%` }} />
            <div className="bg-muted/50 transition-all" style={{ width: `${(n("errored") / checks.length) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {done} of {checks.length} done · <span className="text-pass">{n("passed")} passed</span> · <span className="text-fail">{n("failed")} failed</span> · {n("errored")} errored · {n("running")} running
          </p>
        </div>
      )}

      {checks.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((c) => <Tile key={c.id} c={c} trailId={trailId} />)}
        </ul>
      )}
    </>
  );
}
