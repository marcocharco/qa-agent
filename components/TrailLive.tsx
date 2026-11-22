"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { buildCards, summarize, verdictOf, type Card, type Verdict } from "@/lib/overview";
import type { Live, RequirementRow } from "@/lib/queries";
import RunNow from "./RunNow";
import StatusIcon from "./StatusIcon";
import { seconds } from "./ui";

export type Job = { running: boolean; exitCode: number | null; log: string[]; problem: string | null } | null;

type Ctx = { live: Live; job: Job; starting: boolean; begin: () => void; cards: Card[]; verdict: Verdict; /** The agent's actions so far, per check, oldest first. Kept here so it survives changing requirement or tab. */ trace: Record<string, string[]> };
const LiveContext = createContext<Ctx | null>(null);

export const useTrailLive = () => {
  const c = useContext(LiveContext);
  if (!c) throw new Error("useTrailLive needs TrailLiveProvider");
  return c;
};

/** One poll of the Trail's run state, shared by every tab: the status bar above the tabs and the Run view read the same data. */
export function TrailLiveProvider({ trailId, fresh, regression, initial, children }: { trailId: string; fresh: RequirementRow[]; regression: RequirementRow[]; initial: Live; children: React.ReactNode }) {
  const [live, setLive] = useState(initial);
  const [job, setJob] = useState<Job>(null);
  const [starting, setStarting] = useState(false);
  const [trace, setTrace] = useState<Record<string, string[]>>({});
  const poll = useCallback(async () => {
    try {
      const d = await (await fetch(`/api/trails/${trailId}/live`, { cache: "no-store" })).json();
      setLive(d.live);
      setJob(d.job);
      setTrace((prev) => {
        let next: Record<string, string[]> | null = null;
        for (const c of d.live.checks as { id: string; now?: string | null }[]) {
          if (!c.now || prev[c.id]?.at(-1) === c.now) continue;
          next ??= { ...prev };
          next[c.id] = [...(prev[c.id] ?? []), c.now].slice(-60);
        }
        return next ?? prev;
      });
    } catch { /* the next poll retries */ }
  }, [trailId]);
  useEffect(() => {
    const t = setInterval(poll, 2500);
    const first = setTimeout(poll, 0);
    return () => { clearInterval(t); clearTimeout(first); };
  }, [poll]);
  // From the click on Run now until the run shows up in the next poll.
  const begin = useCallback(() => { setStarting(true); void poll().finally(() => setStarting(false)); }, [poll]);
  const cards = useMemo(() => buildCards(fresh, regression, live), [fresh, regression, live]);
  const verdict = verdictOf(cards, live);
  return <LiveContext.Provider value={{ live, job, starting, begin, cards, verdict, trace }}>{children}</LiveContext.Provider>;
}

const verdictUi: Record<Verdict, { text: string; cls: string; icon: "running" | "passed" | "failed" | "review" | "todo" | "errored" }> = {
  running: { text: "Running", cls: "bg-accent/10 text-accent", icon: "running" },
  merge: { text: "All clear", cls: "bg-pass/10 text-pass", icon: "passed" },
  review: { text: "Needs a look", cls: "bg-accent/10 text-accent", icon: "review" },
  hold: { text: "Blocked", cls: "bg-fail/10 text-fail", icon: "failed" },
  idle: { text: "Not run yet", cls: "bg-chip text-muted", icon: "todo" },
  broken: { text: "Run failed", cls: "bg-chip text-muted", icon: "errored" },
};

/** How long the run took, or how long it has been going. */
function Elapsed({ startedAt, finishedAt }: { startedAt: string; finishedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (finishedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finishedAt]);
  const ms = (finishedAt ? +new Date(finishedAt) : now) - +new Date(startedAt);
  return <span className="text-xs tabular-nums text-muted">{finishedAt ? "Ran for" : "Running for"} {seconds(Math.max(0, ms))}</span>;
}

/** The Trail's run state, above the tabs on every tab: verdict, progress, counts, how long it took, and Run now or Stop. */
export function TrailStatusBar({ trailId }: { trailId: string }) {
  const { live, job, starting, begin, cards, verdict } = useTrailLive();
  const pathname = usePathname();
  const seg3 = pathname.split("/")[3];
  const onRunTab = !seg3 || seg3 === "run" || seg3 === "checks";
  const s = summarize(cards);
  const v = verdictUi[verdict];
  const seg = (n: number, cls: string) => n > 0 && <div className={`${cls} transition-all`} style={{ flex: n }} />;
  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-panel px-5 py-2.5">
        <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${v.cls}`}><StatusIcon state={v.icon} size={16} />{v.text}</span>
        <div className="flex h-2.5 min-w-[180px] flex-1 overflow-hidden rounded-full bg-chip" role="img" aria-label="Progress">
          {seg(s.passed, "bg-pass")}{seg(s.failed, "bg-fail")}{seg(s.review, "bg-accent/70")}{seg(s.errored, "bg-muted/50")}{seg(s.running, "bg-accent animate-pulse")}{seg(s.todo, "bg-transparent")}
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          {([["passed", s.passed], ["failed", s.failed], ["review", s.review], ["running", s.running]] as const).filter(([, n]) => n > 0).map(([st, n]) => (
            <span key={st} className="flex items-center gap-1.5"><StatusIcon state={st} size={15} />{n}</span>
          ))}
          {s.todo > 0 && <span className="flex items-center gap-1.5 text-muted"><StatusIcon state="todo" size={15} />{s.todo}</span>}
        </div>
        {live.run && <Elapsed startedAt={live.run.startedAt} finishedAt={live.run.finishedAt} />}
        <RunNow trailId={trailId} goToRun={!onRunTab} running={verdict === "running" || !!job?.running || starting} onStart={begin} />
      </section>
  );
}
