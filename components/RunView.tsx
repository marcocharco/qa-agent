"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { setStatus } from "@/app/actions";
import { cleanAction } from "@/lib/collapse";
import { currentStep, defaultCard, groupByFeature, type FeatureGroup, shortLabel, splitReason, titleCase, type Card } from "@/lib/overview";
import Replay, { type ReplayData } from "./Replay";
import RerunTest from "./RerunTest";
import StatusIcon from "./StatusIcon";
import { type Job, useTrailLive } from "./TrailLive";
import { btnGhost } from "./ui";

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

const ROW = 28;
const FADE = "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)";

/**
 * A roller of the agent's actions: what it just finished above, what it is doing in the middle, the test's next step
 * below. When the agent moves on, everything slides up one row and the new action rises into the middle.
 * "Next" is the test's next step, since the agent does not announce its own.
 */
function Feed({ now, steps }: { now: string | null; steps: string[] }) {
  const [st, setSt] = useState({ cur: now, hist: [] as { id: number; text: string }[], idx: 0, n: 0 });
  if (now && now !== st.cur) {
    setSt({
      cur: now, n: st.n + 1, idx: currentStep(now, steps, st.idx),
      hist: st.cur ? [...st.hist, { id: st.n, text: st.cur }].slice(-40) : st.hist,
    });
  }
  const next = steps[st.idx + 1] ?? (st.idx + 1 === steps.length ? "Read the result" : null);
  const rows = [
    ...st.hist.map((h) => ({ key: `h${h.id}`, text: cleanAction(h.text), role: "done" as const })),
    { key: `h${st.n}`, text: st.cur ? cleanAction(st.cur) : "Starting the browser", role: "now" as const },
    ...(next ? [{ key: `x${next}`, text: next, role: "next" as const }] : []),
  ];
  return (
    <div className="relative mt-4 overflow-hidden border-t border-line pt-1" style={{ height: ROW * 3 + 4, maskImage: FADE, WebkitMaskImage: FADE }} aria-live="polite">
      <div className="transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none" style={{ transform: `translateY(${(1 - st.hist.length) * ROW}px)` }}>
        {rows.map((r) => (
          <p key={r.key} className={`flex items-center gap-2.5 text-sm transition-opacity duration-300 ${r.role === "now" ? "font-medium" : "text-muted"} ${r.role === "now" ? "opacity-100" : r.role === "done" ? "opacity-60" : "opacity-50"}`} style={{ height: ROW }}>
            <span className="flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden>
              {r.role === "done" ? <span className="text-[10px]">✓</span> : <span className={`h-2.5 w-2.5 rounded-full border-[1.5px] ${r.role === "now" ? "border-foreground" : "border-muted"}`} />}
            </span>
            <span className={`truncate ${r.role === "now" ? "shimmer" : ""}`} title={r.text}>{r.text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** What the agent is doing, in the test's own steps. Not the agent's raw action log. */
function ProgressPanel({ group: all }: { group: FeatureGroup | undefined }) {
  // A single rerun shares its feature with results that are already in: only the checks being run belong here.
  const group = all && { ...all, cards: all.cards.filter((c) => c.state === "running") };
  const now = group?.cards.map((c) => c.check?.now).find(Boolean) ?? null;
    // The agent says which check it is on ("CHECK 2 step 3"). Before that, it is on the first.
  const active = Math.max(0, Math.min((group?.cards.length ?? 1) - 1, Number(/check (\d+)/i.exec(now ?? "")?.[1] ?? 1) - 1));
  return (
    <section className="rounded-2xl border border-line bg-background p-4" role="status">
      <h2 className="text-sm font-semibold">Progress</h2>
      {group && <p className="mt-0.5 text-xs text-muted">{titleCase(group.feature)} · check {active + 1} of {group.cards.length}</p>}
      <ol className="mt-4 space-y-3">
        {group?.cards.map((c, i) => (
          <li key={c.req.id} className={i > active ? "opacity-50" : ""}>
            <p className="flex items-start gap-2 text-sm font-medium">
              <span className="mt-0.5 shrink-0">{i < active ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-chip text-[10px] text-muted">✓</span> : i === active ? <span className="flex h-4 w-4 items-center justify-center" aria-label="In progress"><span className="live-dot" /></span> : <StatusIcon state="todo" size={15} />}</span>
              <span>{shortLabel(c.req.text, 70)}</span>
            </p>
            {i === active && !!c.req.steps?.length && (
              <ol className="ml-6 mt-1.5 space-y-1 text-sm text-muted">
                {c.req.steps.map((st, k) => <li key={k} className="flex gap-2"><span className="w-4 shrink-0 text-right font-mono text-xs leading-5">{k + 1}</span><span>{st}</span></li>)}
              </ol>
            )}
          </li>
        ))}
      </ol>
      <Feed key={`${group?.cards[active]?.req.id ?? "none"}`} now={now} steps={group?.cards[active]?.req.steps ?? []} />
    </section>
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

export default function RunView({ trailId }: { trailId: string }) {
  const { live, job, starting, begin, cards, verdict } = useTrailLive();
  const groups = useMemo(() => groupByFeature(cards), [cards]);
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
  // While browsers work, the right column is the step-by-step progress. Once a task is chosen or the run ends, it is the result.
  const progressGroup = liveGroup ?? groups.find((g) => g.state === "running");
  const showProgress = (running || opening) && mode === "auto";
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

      <div className="mt-3 grid items-start gap-3 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <nav className="min-h-0 overflow-auto rounded-2xl lg:max-h-[calc(100vh-256px)] lg:min-h-[320px] border border-line bg-background p-2" aria-label="Requirements by feature">
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

        <div className="mx-auto flex w-full min-w-0 flex-col gap-3" style={{ maxWidth: "max(560px, calc((100vh - 440px) * 16 / 9))" }}>
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

        </div>

        <aside className="min-w-0 lg:col-span-2 xl:col-span-1" aria-label={showProgress ? "Progress" : "Result"}>
          {showProgress ? <ProgressPanel group={progressGroup} /> : sel && (
            <section className="rounded-2xl border border-line bg-background p-4">
              <p className="flex items-start gap-2.5 font-medium"><span className="mt-0.5 shrink-0"><StatusIcon state={sel.state} /></span><span>{shortLabel(sel.req.text, 90)}</span></p>
              {claim && <p className="mt-3 text-sm text-muted">{claim}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {sel.state === "proposed" && <button className={btnGhost} onClick={() => void setStatus(sel.req.id, "approved")}>Approve</button>}
                {sel.state !== "proposed" && sel.state !== "todo" && sel.state !== "running" && <RerunTest trailId={trailId} requirementId={sel.req.id} disabled={running || !!job?.running || starting} onStart={begin} />}
                {sel.state === "failed" && sel.check && <Link className="ml-auto text-sm font-medium text-accent hover:underline" href={`/t/${trailId}/checks/${sel.check.id}`}>Bug report →</Link>}
              </div>
              {!!sel.req.steps?.length && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-xs font-semibold text-muted">Steps</p>
                  <ol className="mt-1.5 space-y-1 text-sm">
                    {sel.req.steps.map((st, i) => (
                      <li key={i} className="flex gap-2"><span className="w-4 shrink-0 text-right font-mono text-xs leading-5 text-muted">{i + 1}</span><span>{st}</span></li>
                    ))}
                  </ol>
                </div>
              )}
              <details className="mt-3 text-xs text-muted">
                <summary>Details</summary>
                <div className="mt-2 space-y-2"><p>{sel.req.text}</p>{saw && <p className="font-mono">Saw: {saw}</p>}{sel.req.quote && <p className="italic">&ldquo;{sel.req.quote}&rdquo;</p>}</div>
              </details>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
