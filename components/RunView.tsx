"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { setStatus } from "@/app/actions";
import { buildCards, defaultCard, groupByFeature, shortLabel, splitReason, summarize, titleCase, verdictOf, type Card, type Verdict } from "@/lib/overview";
import type { Live, RequirementRow } from "@/lib/queries";
import Replay, { type ReplayData } from "./Replay";
import RerunTest from "./RerunTest";
import RunNow from "./RunNow";
import StatusIcon from "./StatusIcon";
import { ago, btnGhost } from "./ui";

const verdictUi: Record<Verdict, { text: string; cls: string; icon: "running" | "passed" | "failed" | "review" | "todo" | "errored" }> = {
  running: { text: "Running", cls: "bg-accent/10 text-accent", icon: "running" },
  merge: { text: "All clear", cls: "bg-pass/10 text-pass", icon: "passed" },
  review: { text: "Needs a look", cls: "bg-accent/10 text-accent", icon: "review" },
  hold: { text: "Blocked", cls: "bg-fail/10 text-fail", icon: "failed" },
  idle: { text: "Not run yet", cls: "bg-chip text-muted", icon: "todo" },
  broken: { text: "Run failed", cls: "bg-chip text-muted", icon: "errored" },
};

type Job = { running: boolean; exitCode: number | null; log: string[]; problem: string | null } | null;

/** Shown from the click on Run now until the first browser streams, so the preview is never a stale replay. */
function StartingPanel({ job }: { job: Job }) {
  const last = job?.log.filter((l) => l.trim() && !/^\s*[{}]/.test(l)).at(-1)?.replace(/^\d{2}:\d{2}:\d{2}\s+/, "");
  return (
    <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-panel px-6 text-center" role="status">
      <StatusIcon state="running" size={32} />
      <p className="font-medium">Starting the run</p>
      <p className="max-w-md text-sm text-muted">Reading the Trail, turning requirements into browser goals, then opening the browsers. The live view appears here as soon as the first one starts.</p>
      {last && <p className="max-w-lg truncate font-mono text-xs text-muted">{last}</p>}
    </div>
  );
}

function LiveFrame({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-background px-4 py-2.5 text-xs">
        <span className="flex items-center gap-2 font-medium"><StatusIcon state="running" size={14} />{label}</span>
        {url?.startsWith("http") && <a className="font-medium text-accent hover:underline" href={url} target="_blank" rel="noreferrer">Open in a tab ↗</a>}
      </div>
      {url?.startsWith("http") ? (
        <iframe src={url} title={`Live browser: ${label}`} className="aspect-video w-full bg-panel" />
      ) : (
        <div className="flex aspect-video items-center justify-center text-sm text-muted">Starting the browser...</div>
      )}
    </div>
  );
}

/** Replay of the selected check once its session has finished. */
function ReplayPane({ card }: { card: Card }) {
  const id = card.check?.id;
  const [data, setData] = useState<{ id: string; replay: ReplayData | null; failing: boolean } | null>(null);
  useEffect(() => {
    if (!id) return;
    let stop = false;
    fetch(`/api/checks/${id}/replay`).then((r) => r.json()).then((d) => { if (!stop && !d.error) setData({ id, ...d }); }).catch(() => {});
    return () => { stop = true; };
  }, [id]);
  const mine = data?.id === id ? data : null;
  if (mine?.replay) return <div className="min-h-0 flex-1 overflow-auto"><Replay key={id} r={mine.replay} failing={mine.failing} checkId={id} /></div>;
  return (
    <div className="flex min-h-[260px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-6 text-center text-sm text-muted">
      <StatusIcon state={card.state} size={28} />
      {!id ? "This requirement has not run yet." : mine ? "No recording for this check. Runs from now on keep one." : "Loading the replay..."}
    </div>
  );
}

export default function RunView({ trailId, fresh, regression, initial }: { trailId: string; fresh: RequirementRow[]; regression: RequirementRow[]; initial: Live }) {
  const [live, setLive] = useState(initial);
  const [job, setJob] = useState<Job>(null);
  const [starting, setStarting] = useState(false);
  const poll = useCallback(async () => {
    try {
      const d = await (await fetch(`/api/trails/${trailId}/live`, { cache: "no-store" })).json();
      setLive(d.live);
      setJob(d.job);
    } catch { /* the next poll retries */ }
  }, [trailId]);
  useEffect(() => {
    const t = setInterval(poll, 2500);
    const first = setTimeout(poll, 0);
    return () => { clearInterval(t); clearTimeout(first); };
  }, [poll]);

  const cards = useMemo(() => buildCards(fresh, regression, live), [fresh, regression, live]);
  const groups = useMemo(() => groupByFeature(cards), [cards]);
  const s = summarize(cards);
  const verdict = verdictOf(cards, live);
  const v = verdictUi[verdict];
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<"auto" | "replay">("auto");
  const [pinned, setPinned] = useState<string | null>(null);

  const sel = cards.find((c) => c.req.id === picked) ?? defaultCard(cards);
  const running = verdict === "running";
  const runOpen = !!live.run && !live.run.finishedAt;
  // From the click on Run now until a run row exists, and while a run waits for its first browser.
  const opening = (starting || !!job?.running) && !runOpen;
  const waitingForBrowser = running && mode === "auto";
  const liveGroup = groups.find((g) => g.feature === pinned && g.streamingUrl) ?? groups.find((g) => g.streamingUrl);
  // While a run is open the preview follows the live session. Choosing a finished task, or a run that has ended, shows its replay.
  const showLive = running && !!liveGroup && mode === "auto";
  const seg = (n: number, cls: string) => n > 0 && <div className={`${cls} transition-all`} style={{ flex: n }} />;
  const { claim, saw } = splitReason(sel?.check?.reason ?? null);

  const choose = (c: Card) => {
    setPicked(c.req.id);
    setMode(c.state === "running" || !c.check ? "auto" : "replay");
  };

  return (
    <div>
      {live.newestBroken && !opening && (
        <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-xl bg-fail/5 px-4 py-3 text-sm">
          <span className="mt-0.5"><StatusIcon state="failed" /></span>
          <div>
            <p className="font-medium">The newest run could not start any test, so this shows the run before it.</p>
            <p className="mt-0.5 text-muted">{job?.problem ?? "If the model is out of credits, new runs fail until that is fixed."}</p>
          </div>
        </div>
      )}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-panel px-5 py-3.5">
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
        {live.run && <span className="text-xs text-muted">{ago(live.run.startedAt)}</span>}
        <RunNow trailId={trailId} goToRun={false} running={running || !!job?.running || starting} onStart={() => { setStarting(true); void poll().finally(() => setStarting(false)); }} />
      </section>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="min-h-0 overflow-auto rounded-2xl lg:max-h-[calc(100vh-300px)] lg:min-h-[320px] border border-line bg-background p-2" aria-label="Requirements by feature">
          <h2 className="px-2.5 pb-1 pt-2 text-sm font-semibold">Requirements</h2>
          {groups.map((g) => (
            <div key={g.feature} className="mb-2">
              <p className="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">{titleCase(g.feature)}</p>
              {g.cards.map((c) => (
                <button key={c.req.id} onClick={() => choose(c)} aria-current={sel?.req.id === c.req.id}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${sel?.req.id === c.req.id ? "bg-chip font-medium" : "hover:bg-chip/60"}`}>
                  <StatusIcon state={c.state} />
                  <span className="truncate">{shortLabel(c.req.text, 34)}</span>
                </button>
              ))}
            </div>
          ))}
          {!cards.length && <p className="px-3 py-8 text-center text-sm text-muted">No requirements yet. Add some in Requirements.</p>}
        </nav>

        <div className="flex min-w-0 flex-col gap-3">
          {running && groups.some((g) => g.streamingUrl) && (
            <div className="flex flex-wrap items-center gap-2" aria-label="Browser sessions">
              {groups.filter((g) => g.streamingUrl).map((g) => (
                <button key={g.feature} onClick={() => { setPinned(g.feature); setMode("auto"); }}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${showLive && liveGroup?.feature === g.feature ? "border-foreground bg-chip" : "border-line hover:bg-chip"}`}>
                  <StatusIcon state={g.state} size={13} />{titleCase(g.feature)}
                </button>
              ))}
              {mode === "replay" && <button className="text-xs font-medium text-accent hover:underline" onClick={() => setMode("auto")}>Back to live</button>}
            </div>
          )}
          {showLive ? <LiveFrame url={liveGroup!.streamingUrl} label={`Live: ${liveGroup!.feature}`} />
            : (opening || waitingForBrowser) && mode === "auto" ? <StartingPanel job={job} />
            : sel ? <ReplayPane card={sel} />
            : <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-muted">Nothing to show yet.</div>}

          {sel && (
            <section className="rounded-2xl border border-line bg-background px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2.5 font-medium"><StatusIcon state={sel.state} /><span className="truncate">{shortLabel(sel.req.text, 80)}</span></p>
                <div className="flex shrink-0 items-center gap-3">
                  {sel.state === "proposed" && <button className={btnGhost} onClick={() => void setStatus(sel.req.id, "approved")}>Approve</button>}
                  {sel.state !== "proposed" && sel.state !== "todo" && sel.state !== "running" && <RerunTest trailId={trailId} requirementId={sel.req.id} disabled={running || !!job?.running || starting} onStart={() => { setStarting(true); void poll().finally(() => setStarting(false)); }} />}
                  {sel.state === "failed" && sel.check && <Link className="text-sm font-medium text-accent hover:underline" href={`/t/${trailId}/checks/${sel.check.id}`}>Bug report →</Link>}
                </div>
              </div>
              {claim && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{claim}</p>}
              <details className="mt-1.5 text-xs text-muted">
                <summary className="cursor-pointer">Details</summary>
                <div className="mt-2 max-w-3xl space-y-2"><p>{sel.req.text}</p>{saw && <p className="font-mono">Saw: {saw}</p>}{sel.req.quote && <p className="italic">&ldquo;{sel.req.quote}&rdquo;</p>}</div>
              </details>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
