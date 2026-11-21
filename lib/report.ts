// Pure helpers for the dashboard: check status, receipt context window, Markdown reports.

export type CheckStatus = "running" | "passed" | "failed" | "errored";

export type CheckLike = { passed: boolean | null; reason: string | null };

/**
 * The orchestrator writes `passed` only when the agent gave a verdict. A null `passed` with a reason is an
 * errored run, a null `passed` without one is still running (or, once the run is finished, never completed).
 */
export function checkStatus(c: CheckLike, runFinished: boolean): CheckStatus {
  if (c.passed === true) return "passed";
  if (c.passed === false) return "failed";
  return c.reason || runFinished ? "errored" : "running";
}

export type Message = { id: string; role: string; text: string };
export type ReceiptMessage = Message & { highlight: boolean };

/** The cited message plus `radius` messages on each side. Empty when the id is not in the transcript. */
export function receiptWindow(messages: Message[], messageId: string, radius = 2): ReceiptMessage[] {
  const at = messages.findIndex((m) => m.id === messageId);
  if (at < 0) return [];
  return messages.slice(Math.max(0, at - radius), at + radius + 1).map((m) => ({ ...m, highlight: m.id === messageId }));
}

export type ReportData = {
  requirement: string;
  trailTitle: string;
  commit: string;
  verdict: "failed" | "errored";
  reason: string;
  failedStep: number | null;
  steps: string[];
  quote: string | null;
  checkUrl?: string;
};

const stepLines = (d: ReportData) => d.steps.map((s, i) => `${i + 1}. ${s}${d.failedStep === i + 1 ? " **(fails here)**" : ""}`);

/** Level 1 or 2 as Markdown, for Jira, GitHub and Linear. */
export function reportMarkdown(d: ReportData, level: 1 | 2): string {
  const head = [`## Bug: ${d.requirement}`, "", `**Verdict:** ${d.verdict}`, `**What went wrong:** ${d.reason}`];
  if (level === 1) return head.join("\n");
  return [
    ...head,
    `**Trail:** ${d.trailTitle} (commit \`${d.commit.slice(0, 7)}\`)`,
    "",
    "### Steps to reproduce",
    ...(d.steps.length ? stepLines(d) : ["_No steps were recorded._"]),
    "",
    `**Expected:** ${d.requirement}`,
    `**Actual:** ${d.reason}`,
    ...(d.quote ? ["", `> Requested in chat: "${d.quote}"`] : []),
  ].join("\n");
}

/** Compact problem summary and repro for pasting into Claude Code. No instructions. */
export function claudeCodeSummary(d: ReportData): string {
  return [
    `Problem: ${d.requirement}`,
    `Observed: ${d.reason}`,
    `Commit: ${d.commit.slice(0, 7)}`,
    "",
    "Repro:",
    ...(d.steps.length ? stepLines(d).map((l) => l.replace(" **(fails here)**", "  <- fails here")) : ["(no steps recorded)"]),
  ].join("\n");
}
