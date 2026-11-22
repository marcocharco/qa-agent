"use client";

import Link from "next/link";
import { useState } from "react";
import { ago } from "@/components/ui";
import type { Data } from "../types";
import { Badge, LiveBrowser, ReqActions, TopBar, buildCards, summarize, useLive, verdictOf, verdictTone, type Card, type Lane } from "../shared";

const dot: Record<Lane, string> = { proposed: "bg-accent", ready: "bg-muted/50", running: "bg-accent animate-pulse", passed: "bg-pass", attention: "bg-fail" };

function Widget({ title, className = "", right, children }: { title: string; className?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`flex min-h-0 flex-col rounded-2xl border border-line bg-background ${className}`}>
      <header className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">{title}</h2>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">{children}</div>
    </section>
  );
}

export default function Widgets({ data }: { data: Data }) {
  const live = useLive(data.trailId, data.live);
  const cards = buildCards(data, live);
  const s = summarize(cards);
  const v = verdictOf(cards);
  const [tab, setTab] = useState<"new" | "regression">("new");
  const list = cards.filter((c) => (tab === "new" ? !c.regression : c.regression));
  const attention = cards.filter((c) => c.lane === "attention");
  const drifts = data.fresh.filter((r) => r.supersedes && r.status === "proposed");
  const runs = [...data.history].reverse().slice(-8);
  const blocked = s.failed > 0;
  return (
    <main className="mx-auto w-full max-w-[1500px] px-6 pt-8">
      <TopBar data={data} live={live} />
      <div className="mt-6 grid grid-cols-12 gap-4">
        <LiveBrowser live={live} className="col-span-12 h-[420px] lg:col-span-7" />
        <Widget title="Verdict" className="col-span-12 h-[420px] lg:col-span-5">
          <p className={`text-2xl font-semibold leading-snug tracking-tight ${verdictTone[v.verdict]}`}>{v.text.split("\n")[0]}</p>
          <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
            {[["Pass", s.passed, "text-pass"], ["Fail", s.failed, "text-fail"], ["Flaky", s.review, "text-accent"], ["Open", s.proposed + s.ready, "text-foreground"]].map(([k, n, tone]) => (
              <div key={String(k)} className="rounded-xl bg-panel py-3"><dd className={`text-2xl font-semibold ${tone}`}>{n}</dd><dt className="text-xs text-muted">{k}</dt></div>
            ))}
          </dl>
          <div className={`mt-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${blocked ? "bg-fail/10 text-fail" : "bg-pass/10 text-pass"}`}>
            <span className="font-medium">Merge gate</span>
            <span>{blocked ? `Blocked by ${s.failed} open ${s.failed === 1 ? "finding" : "findings"}` : "Clear"}</span>
          </div>
          {s.failures.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {s.failures.slice(0, 4).map((f) => <li key={f.text} className="line-clamp-2 text-muted">· {f.text}</li>)}
            </ul>
          )}
        </Widget>
        <Widget title="Requirements" className="col-span-12 h-[380px] lg:col-span-7"
          right={
            <div className="flex gap-1 rounded-full bg-chip p-0.5 text-xs font-medium">
              {(["new", "regression"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 ${tab === t ? "bg-background shadow-sm" : "text-muted"}`}>{t === "new" ? `New ${cards.filter((c) => !c.regression).length}` : `Regression ${cards.filter((c) => c.regression).length}`}</button>
              ))}
            </div>
          }>
          <ul className="divide-y divide-line">
            {list.map((c: Card) => (
              <li key={c.req.id} className="flex items-start gap-3 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[c.lane]}`} />
                <p className="min-w-0 flex-1 text-[13px] leading-snug">{c.req.text}</p>
                {c.check ? <Badge status={c.check.status} /> : c.lane === "proposed" ? <ReqActions r={c.req} compact /> : <span className="text-xs text-muted">ready</span>}
              </li>
            ))}
          </ul>
        </Widget>
        <Widget title="Needs you" className="col-span-12 h-[380px] lg:col-span-5" right={<span className="text-xs text-muted">{attention.length + drifts.length}</span>}>
          {drifts.map((r) => (
            <div key={r.id} className="mb-3 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
              <p className="text-xs font-medium text-accent">Changes an earlier requirement</p>
              <p className="mt-1 text-muted line-through">{r.supersedes!.text}</p>
              <p className="mt-1">{r.text}</p>
              <div className="mt-2"><ReqActions r={r} compact /></div>
            </div>
          ))}
          {attention.map((c) => (
            <div key={c.req.id} className="mb-3 rounded-xl border border-line p-3 text-sm">
              <div className="flex items-start justify-between gap-2"><p className="leading-snug">{c.req.text}</p><Badge status={c.check!.status} /></div>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted">{c.check!.reason}</p>
              {c.check!.status === "failed" && <Link className="mt-1.5 inline-block text-xs font-medium text-accent hover:underline" href={`/t/${data.trailId}/checks/${c.check!.id}`}>Bug report →</Link>}
            </div>
          ))}
          {!attention.length && !drifts.length && <p className="py-10 text-center text-sm text-muted">Nothing needs you right now.</p>}
        </Widget>
        <Widget title="Coverage" className="col-span-12 h-[200px] md:col-span-4">
          <p className="text-3xl font-semibold">{data.coverage.live - data.coverage.neverRun.length}<span className="text-lg text-muted"> / {data.coverage.asks}</span></p>
          <p className="mt-1 text-sm text-muted">asks from the chat have a test</p>
          <p className="mt-3 text-xs text-muted">{data.coverage.neverRun.length} not run yet · {data.coverage.untestable.length} cannot be tested</p>
        </Widget>
        <Widget title="Runs" className="col-span-12 h-[200px] md:col-span-4" right={<Link className="text-xs font-medium text-accent hover:underline" href={`/t/${data.trailId}/history`}>All runs</Link>}>
          <div className="flex h-24 items-end gap-1.5">
            {runs.map((r) => {
              const t = Math.max(1, r.passed + r.failed + r.errored);
              return (
                <div key={r.id} title={`${ago(r.startedAt)}: ${r.passed} pass, ${r.failed} fail`} className="flex w-full max-w-10 flex-1 flex-col overflow-hidden rounded-md" style={{ height: `${Math.min(100, t * 14)}%` }}>
                  <div className="bg-fail" style={{ flex: r.failed }} /><div className="bg-muted/40" style={{ flex: r.errored }} /><div className="bg-pass" style={{ flex: r.passed }} />
                </div>
              );
            })}
            {!runs.length && <p className="text-sm text-muted">No runs yet.</p>}
          </div>
        </Widget>
        <Widget title="Intent" className="col-span-12 h-[200px] md:col-span-4">
          <p className="text-sm leading-relaxed text-muted">{data.trail.description}</p>
        </Widget>
      </div>
    </main>
  );
}
