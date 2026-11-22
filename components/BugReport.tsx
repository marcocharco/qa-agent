"use client";

import { collapseSteps } from "@/lib/collapse";
import { useState } from "react";
import { claudeCodeSummary, reportMarkdown, type ReportData } from "@/lib/report";
import type { CheckDetail } from "@/lib/queries";
import Replay from "./Replay";
import { btn, btnGhost, chip } from "./ui";

type Level = 1 | 2 | 3 | 4 | 5;
const NAMES = ["Summary", "Repro", "Code", "History", "Prompt"];

export default function BugReport({ check, findingOpen }: { check: CheckDetail; findingOpen: boolean | null }) {
  const c = check;
  const has: Record<Level, boolean> = { 1: true, 2: true, 3: !!c.file, 4: !!(c.commit && c.checkpointId), 5: !!c.promptSessionId };
  const [level, setLevel] = useState<Level>(2);
  const [copied, setCopied] = useState("");
  const [resolved, setResolved] = useState<string | null>(findingOpen === false ? "The Entire finding is resolved." : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // With a recording, show the logical steps (repeated clicks and page reads collapsed), the last one being where it broke.
  const steps = c.replay ? collapseSteps(c.replay.steps.slice(c.replay.start, c.replay.end + 1)).map((g) => g.label) : c.steps;
  const failedStep = c.replay ? (c.status === "failed" ? steps.length : null) : c.failedStep;
  const data: ReportData = {
    requirement: c.requirement, trailTitle: c.trailTitle, commit: c.commit, verdict: c.status === "errored" ? "errored" : "failed",
    reason: c.reason ?? "No details.", failedStep, steps, quote: c.quote,
  };

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  }

  function markdown() {
    const base = reportMarkdown(data, level >= 2 ? 2 : 1);
    const extra = [
      level >= 3 && c.file ? `\n### Likely code\n\`${c.file}${c.line ? `:${c.line}` : ""}\`` : "",
      level >= 4 && has[4] ? `\n### History\nCommit \`${c.commit.slice(0, 7)}\`, checkpoint \`${c.checkpointId}\`` : "",
      level >= 5 && c.promptSessionId ? `\n### Prompt\nSession \`${c.promptSessionId}\`, message \`${c.promptMessageId ?? "unknown"}\`` : "",
    ];
    return base + extra.join("");
  }

  async function override(kind: "not-a-bug" | "requirement-wrong") {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/checks/${c.id}/override`, { method: "POST", body: JSON.stringify({ kind }) });
    const body = await res.json();
    setBusy(false);
    if (res.ok) setResolved(body.message);
    else setError(body.error);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Zoom level" className="inline-flex rounded-full border border-line bg-panel p-1">
          {NAMES.map((n, i) => {
            const l = (i + 1) as Level;
            if (!has[l]) return null;
            return (
              <button key={n} role="tab" aria-selected={level === l} onClick={() => setLevel(l)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${level === l ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}>
                {l}. {n}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => copy("md", markdown())}>{copied === "md" ? "Copied" : "Copy as Markdown"}</button>
          <button className={btn} onClick={() => copy("cc", claudeCodeSummary(data))}>{copied === "cc" ? "Copied" : "Copy for Claude Code"}</button>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-line p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === "failed" ? "bg-fail/10 text-fail" : "bg-chip text-muted"}`}>{c.status}</span>
          {c.failedStep && <span className={chip}>failed at step {c.failedStep}</span>}
          <span className={chip}>commit {c.commit.slice(0, 7)}</span>
        </div>
        <h2 className="mt-4 text-2xl font-semibold leading-snug tracking-tight">{c.requirement}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{c.reason}</p>
      </section>

      {level >= 2 && c.replay && <div className="mt-6"><Replay r={c.replay} failing={c.status === "failed"} checkId={c.id} /></div>}

      {level >= 2 && (
        <section className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-line p-6">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted">Steps to reproduce</h3>
            {steps.length ? (
              <ol className="mt-4 space-y-2">
                {steps.map((s, i) => {
                  const bad = failedStep === i + 1;
                  return (
                    <li key={i} className={`flex gap-3 rounded-lg px-3 py-2 text-[15px] ${bad ? "bg-fail/10 text-fail" : ""}`}>
                      <span className={`w-5 shrink-0 text-right font-mono text-sm ${bad ? "" : "text-muted"}`}>{i + 1}</span>
                      <span>{s}{bad && <span className="ml-2 text-xs font-medium">fails here</span>}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-muted">No steps were recorded for this run.</p>
            )}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-line p-6">
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted">Expected</h3>
              <p className="mt-2 text-[15px] leading-relaxed">{c.requirement}</p>
            </div>
            <div className="rounded-2xl border border-fail/40 p-6">
              <h3 className="text-sm font-medium uppercase tracking-wide text-fail">Actual</h3>
              <p className="mt-2 text-[15px] leading-relaxed">{c.reason}</p>
            </div>
            {c.quote && (
              <div className="rounded-2xl border border-line p-6">
                <h3 className="text-sm font-medium uppercase tracking-wide text-muted">Asked in chat</h3>
                <p className="mt-2 border-l-2 border-accent pl-3 text-sm italic text-muted">&ldquo;{c.quote}&rdquo;</p>
              </div>
            )}
          </div>
        </section>
      )}

      {level >= 3 && c.file && (
        <section className="mt-6 rounded-2xl border border-line p-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted">Likely code</h3>
          <p className="mt-2 font-mono text-sm">{c.file}{c.line ? `:${c.line}` : ""}</p>
        </section>
      )}
      {level >= 4 && has[4] && (
        <section className="mt-6 rounded-2xl border border-line p-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted">History</h3>
          <p className="mt-2 text-sm">Commit <span className="font-mono">{c.commit.slice(0, 7)}</span>, checkpoint <span className="font-mono">{c.checkpointId}</span></p>
        </section>
      )}
      {level >= 5 && c.promptSessionId && (
        <section className="mt-6 rounded-2xl border border-line p-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted">Prompt that introduced it</h3>
          <p className="mt-2 text-sm">Session <span className="font-mono">{c.promptSessionId}</span>, message <span className="font-mono">{c.promptMessageId ?? "unknown"}</span></p>
        </section>
      )}

      <section className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        {resolved ? (
          <p className="text-sm text-pass">{resolved}</p>
        ) : c.findingId ? (
          <>
            <span className="text-sm text-muted">Reviewer override, resolves the Entire finding:</span>
            <button className={btnGhost} disabled={busy} onClick={() => override("not-a-bug")}>Not a bug in this run</button>
            <button className={btnGhost} disabled={busy} onClick={() => override("requirement-wrong")}>Requirement is wrong</button>
          </>
        ) : (
          <p className="text-sm text-muted">No Entire finding was filed for this check.</p>
        )}
        {error && <p className="w-full text-sm text-fail">{error}</p>}
      </section>
    </div>
  );
}
