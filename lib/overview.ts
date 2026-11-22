import type { CheckRow, Live, RequirementRow } from "./queries";
import { recommend, type Recommendation } from "./recommendation";

/** Where a requirement sits right now. A check from the latest run wins over the requirement's own status. */
export type IconState = "running" | "passed" | "failed" | "review" | "errored" | "proposed" | "todo";
export type Card = { req: RequirementRow; regression: boolean; check: CheckRow | null; state: IconState };

/** What a run tests from this Trail: testable, and approved or a not yet reviewed non-drift ask. */
const runnable = (r: RequirementRow) => r.testable && (r.status === "approved" || (r.status === "proposed" && !r.supersedes));

export function buildCards(fresh: RequirementRow[], regression: RequirementRow[], live: Live): Card[] {
  const byReq = new Map(live.checks.map((c) => [c.requirementId, c]));
  const mine = fresh.filter(runnable);
  return [...mine.map((r) => ({ r, regression: false })), ...regression.map((r) => ({ r, regression: true }))].map(({ r, regression: reg }) => {
    const check = byReq.get(r.id) ?? null;
    return { req: r, regression: reg, check, state: check ? check.status : r.status === "proposed" ? "proposed" : "todo" };
  });
}

export function summarize(cards: Card[]) {
  const n = (s: IconState) => cards.filter((c) => c.state === s).length;
  const failed = cards.filter((c) => c.state === "failed");
  return {
    total: cards.length, ran: cards.filter((c) => c.check).length,
    passed: n("passed"), failed: failed.length, review: n("review"), errored: n("errored"), running: n("running"), todo: n("todo") + n("proposed"),
    failures: failed.map((c) => ({ text: c.req.text, reason: c.check?.reason ?? "", blocking: c.req.status === "approved" })),
  };
}

export type Verdict = Recommendation["verdict"] | "running" | "idle" | "broken";

export function verdictOf(cards: Card[], live: Live): Verdict {
  if (!live.run) return "idle";
  const s = summarize(cards);
  if (!live.run.finishedAt || s.running > 0) return "running";
  // A finished run that tested nothing is a failed run, never a clean one.
  if (s.ran === 0) return "broken";
  return recommend({ total: s.ran, passed: s.passed, failed: s.failed, needsReview: s.review, errored: s.errored, failures: s.failures }).verdict;
}

/** The one state that stands for a whole group, worst news first. */
export function groupState(cs: Card[]): IconState {
  for (const s of ["running", "failed", "review", "errored"] as const) if (cs.some((c) => c.state === s)) return s;
  if (cs.length && cs.every((c) => c.state === "passed")) return "passed";
  return cs.some((c) => c.state === "proposed") ? "proposed" : "todo";
}

export type FeatureGroup = { feature: string; cards: Card[]; state: IconState; streamingUrl: string | null };

/** Requirements of one feature share one browser session, so a feature is the unit the preview follows. */
export function groupByFeature(cards: Card[]): FeatureGroup[] {
  const m = new Map<string, Card[]>();
  for (const c of cards) m.set(c.req.feature ?? "Other", [...(m.get(c.req.feature ?? "Other") ?? []), c]);
  const groups = [...m].map(([feature, cs]) => ({
    feature, cards: cs, state: groupState(cs),
    streamingUrl: cs.find((c) => c.state === "running" && c.check?.streamingUrl)?.check?.streamingUrl ?? null,
  }));
  // Requirements with no feature are the least important group: last.
  return [...groups.filter((g) => g.feature !== "Other"), ...groups.filter((g) => g.feature === "Other")];
}

/** Feature order of the Run view's list, so the Requirements page can match it: features of what runs first, then the rest, no feature last. */
export function featureOrder(fresh: RequirementRow[], regression: RequirementRow[]): string[] {
  const seen = [...fresh.filter(runnable), ...regression, ...fresh].map((r) => r.feature ?? "Other");
  const all = [...new Set(seen)];
  return [...all.filter((f) => f !== "Other"), ...all.filter((f) => f === "Other")];
}

/** "annual billing" and "ANNUAL BILLING" both read "Annual Billing". */
export const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

/** A short label for a long requirement sentence: the first clause, trimmed. A stored title replaces this later. */
export function shortLabel(text: string, max = 46): string {
  const clause = text.split(/[:.]\s/)[0].replace(/^(The|A|An)\s+/i, "");
  const t = clause.length > max ? clause.slice(0, max).replace(/\s+\S*$/, "") + "..." : clause;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Splits "what happened. Saw: <observed text>" as the orchestrator writes it. */
export function splitReason(reason: string | null): { claim: string; saw: string | null } {
  if (!reason) return { claim: "", saw: null };
  const i = reason.indexOf(" Saw: ");
  return i < 0 ? { claim: reason, saw: null } : { claim: reason.slice(0, i), saw: reason.slice(i + 6) };
}

/** The card to show first: something that needs you, else what is running, else the top of the list. */
export function defaultCard(cards: Card[]): Card | undefined {
  return cards.find((c) => c.state === "failed") ?? cards.find((c) => c.state === "review") ?? cards.find((c) => c.state === "errored") ?? cards.find((c) => c.state === "running") ?? cards[0];
}

export type TrailCard = {
  id: string; title: string; branch: string; state: "open" | "merged";
  toReview: number; requirements: number;
  runOpen: boolean; lastRunAt: string | null;
  passed: number; failed: number; review: number;
};
export type TrailStatus = "running" | "failing" | "review" | "ready" | "idle" | "merged";

/** The one word for a Trail on the home page. What needs attention first wins. */
export function trailStatus(t: TrailCard): TrailStatus {
  if (t.state === "merged") return "merged";
  if (t.runOpen) return "running";
  if (t.failed > 0) return "failing";
  if (t.toReview > 0 || t.review > 0) return "review";
  return t.lastRunAt ? "ready" : "idle";
}

const priority: TrailStatus[] = ["running", "failing", "review", "ready", "idle", "merged"];
export const sortTrails = (ts: TrailCard[]) => [...ts].sort((a, b) => priority.indexOf(trailStatus(a)) - priority.indexOf(trailStatus(b)) || (b.lastRunAt ?? "").localeCompare(a.lastRunAt ?? ""));

const STOP = new Set(["the", "for", "and", "check", "step", "with", "from", "into", "that", "this", "page", "then"]);
const words = (t: string) => new Set(t.toLowerCase().split(/[^a-z0-9$%.]+/).filter((w) => w.length > 2 && !STOP.has(w)));

/** Which of the test's own steps the agent is on. It names the step when it can; otherwise the best word match, never going backwards. */
export function currentStep(action: string, steps: string[], from: number): number {
  // The agent wrapping up means it has done every step.
  if (/^(finish|finished|complete|completed|submit|report|task completed)\b/i.test(action.replace(/^check \d+( step \d+)?:\s*/i, "").trim())) return Math.max(from, steps.length - 1);
  const named = /step\s*(\d+)/i.exec(action)?.[1];
  if (named && Number(named) >= 1 && Number(named) <= steps.length) return Math.max(from, Number(named) - 1);
  const a = words(action);
  let best = -1, score = 0;
  steps.forEach((st, i) => { const n = [...words(st)].filter((w) => a.has(w)).length; if (n > score || (n === score && n > 0 && i < best)) { score = n; best = i; } });
  return best >= 0 ? Math.max(from, best) : from;
}
