"use client";

// Local replay screenshots are plain files served by our own route, next/image adds nothing here.
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { collapseSteps } from "@/lib/collapse";

export type ReplayData = {
  steps: { action: string; durationS: number | null; file: string | null }[];
  video: string | null;
  /** Where the cursor is in each screenshot, as fractions of its size */
  cursors?: Record<string, { x: number; y: number } | null>;
  /** Inclusive range of this check's own steps inside the shared browser session */
  start: number;
  end: number;
};

const src = (file: string) => `/api/replay/${file}`;

/** What the agent did, one frame per step, opening on the moment it went wrong. */
export default function Replay({ r, failing, checkId }: { r: ReplayData; failing: boolean; checkId?: string }) {
  const [mark, setMark] = useState<{ file: string; box: number[] | null; label: string } | null>(null);
  useEffect(() => {
    if (!failing || !checkId) return;
    let stop = false;
    fetch(`/api/checks/${checkId}/highlight`).then((x) => x.json()).then((d) => { if (!stop) setMark(d.highlight); }).catch(() => {});
    return () => { stop = true; };
  }, [failing, checkId]);
  // Logical steps only: repeated clicks and back-to-back page reads collapse into one.
  const frames = useMemo(() => collapseSteps(r.steps.slice(r.start, r.end + 1)), [r]);
  const last = Math.max(0, frames.length - 1);
  const [i, setI] = useState(failing ? last : 0);
  const [mode, setMode] = useState<"steps" | "video">("steps");
  const [playing, setPlaying] = useState(false);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((x) => (x >= last ? (setPlaying(false), x) : x + 1)), 1100);
    return () => clearInterval(t);
  }, [playing, last]);

  useEffect(() => {
    strip.current?.children[i]?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [i]);

  const f = frames[i];
  // The cursor's path up to this step: its last few positions, oldest faintest.
  const raw = r.steps.slice(r.start, r.end + 1);
  const upTo = f ? raw.lastIndexOf(f.frames[f.frames.length - 1]) : -1;
  const path = raw.slice(Math.max(0, upTo - 8), upTo + 1)
    .map((x) => (x.file ? r.cursors?.[x.file] ?? null : null))
    .filter((p, k, a): p is { x: number; y: number } => !!p && (k === 0 || !a[k - 1] || Math.hypot(p.x - a[k - 1]!.x, p.y - a[k - 1]!.y) > 0.004));
  if (!frames.length) return null;
  const go = (n: number) => { setPlaying(false); setI(Math.min(last, Math.max(0, n))); };
  const tab = (m: "steps" | "video", label: string) => (
    <button onClick={() => setMode(m)} className={`rounded-full px-3 py-1 text-xs font-medium ${mode === m ? "bg-background shadow-sm" : "text-muted"}`}>{label}</button>
  );

  return (
    <section className="rounded-2xl border border-line bg-background" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(i + 1); else if (e.key === "ArrowLeft") go(i - 1); }} aria-label="Replay">
      <header className="flex items-center justify-between gap-3 px-[18px] pt-3">
        <h2 className="text-sm font-semibold">Replay</h2>
        {r.video && <div className="flex gap-1 rounded-full bg-chip p-0.5">{tab("steps", "Steps")}{tab("video", "Video")}</div>}
      </header>
      {mode === "video" && r.video ? (
        <video className="mt-3 aspect-video w-full bg-panel" src={src(r.video)} controls preload="metadata" />
      ) : (
        <>
          <div className="relative mt-3 aspect-video w-full overflow-hidden bg-panel">
            {f.file ? (
              <img src={src(f.file)} alt={f.label} className="h-full w-full object-contain" />
            ) : <div className="flex h-full items-center justify-center text-sm text-muted">No screenshot for this step</div>}
            {path.length > 1 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
                {path.slice(1).map((p, k) => {
                  const a = path[k];
                  const fade = (k + 1) / (path.length - 1);
                  return (
                    <g key={k} opacity={0.25 + 0.75 * fade} strokeLinecap="round">
                      <line x1={a.x} y1={a.y} x2={p.x} y2={p.y} stroke="white" strokeWidth={7} vectorEffect="non-scaling-stroke" />
                      <line x1={a.x} y1={a.y} x2={p.x} y2={p.y} stroke="var(--color-accent)" strokeWidth={3.5} vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
              </svg>
            )}
            {failing && mark?.box && f.file === mark.file && (
              <div className="pointer-events-none absolute rounded-md border-2 border-fail bg-fail/10 shadow-[0_0_0_3px_rgba(220,38,38,0.25)]"
                style={{ top: `${mark.box[0] / 10}%`, left: `${mark.box[1] / 10}%`, height: `${(mark.box[2] - mark.box[0]) / 10}%`, width: `${(mark.box[3] - mark.box[1]) / 10}%` }}>
                {mark.label && <span className={`absolute left-0 whitespace-nowrap ${mark.box[2] > 850 ? "bottom-full mb-1" : "top-full mt-1"} rounded-md bg-fail px-2 py-0.5 text-xs font-medium text-white`}>{mark.label}</span>}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <p className="min-w-0 text-sm"><span className="text-muted">Step {i + 1} of {frames.length} · </span>{f.label}{f.frames.length > 1 && <span className="text-muted"> · {f.frames.length} actions</span>}{f.durationS != null && <span className="text-muted"> · {f.durationS}s</span>}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <button className="rounded-full border border-line px-3 py-1 text-sm hover:bg-chip disabled:opacity-40" disabled={i === 0} onClick={() => go(i - 1)} aria-label="Previous step">←</button>
              <button className="rounded-full bg-foreground px-4 py-1 text-sm font-medium text-background" onClick={() => { if (!playing && i >= last) setI(0); setPlaying((p) => !p); }}>{playing ? "Pause" : "Play"}</button>
              <button className="rounded-full border border-line px-3 py-1 text-sm hover:bg-chip disabled:opacity-40" disabled={i === last} onClick={() => go(i + 1)} aria-label="Next step">→</button>
            </div>
          </div>
          <div ref={strip} className="flex gap-2 overflow-x-auto border-t border-line px-5 py-3">
            {frames.map((fr, k) => {
              const bad = failing && k === last;
              const on = k === i;
              // Red border: this step has the error, always. Dark ring with a gap: this is the step on screen.
              return (
                <button key={k} onClick={() => go(k)} aria-label={`Step ${k + 1}: ${fr.label}${bad ? " (error)" : ""}`} aria-current={on}
                  className={`relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-panel ${bad ? "border-fail" : "border-line"} ${on ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"}`}>
                  {fr.file && <img src={src(fr.file)} alt="" className="h-full w-full object-cover" />}
                  {fr.frames.length > 1 && <span className="absolute bottom-1 left-1 rounded-full bg-foreground/80 px-1.5 text-[10px] font-medium text-background">×{fr.frames.length}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
