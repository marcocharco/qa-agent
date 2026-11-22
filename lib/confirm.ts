import type { Verdict } from "./verdict";

/** What a check finally is after the optional second run. */
export type Final =
  | { state: "passed"; classification: null; failedStep: null; reason: string }
  /** Two runs agreed it failed. The only state that files a finding. */
  | { state: "failed"; classification: "bug"; failedStep: number | null; reason: string }
  /** The two runs disagreed, or a failure was seen only once. Shown to a human, files nothing. */
  | { state: "needs_review"; classification: "flaky"; failedStep: null; reason: string }
  /** No trustworthy verdict: the site or run broke (environment) or the agent could not do the steps (test_problem). */
  | { state: "errored"; classification: "environment" | "test_problem"; failedStep: null; reason: string };

/** A first pass needs no second run. Anything else gets exactly one more run in its own session. */
export const needsSecondRun = (first: Verdict) => first.state !== "passed";

/** Combine the first and (if it ran) second verdict. A bug needs two agreeing failures. */
export function reconcile(first: Verdict, second: Verdict | null): Final {
  if (first.state === "passed") return { state: "passed", classification: null, failedStep: null, reason: first.reason };
  if (!second) return fromOne(first);
  if (first.state === "failed" && second.state === "failed") {
    return { state: "failed", classification: "bug", failedStep: second.failedStep ?? first.failedStep, reason: second.reason };
  }
  if (first.state === "errored" && second.state === "errored") return fromOne(second);
  // A run that errored said nothing about the page, so it is not an answer that can disagree. The run that did answer decides.
  if (first.state === "errored" && second.state === "passed") return { state: "passed", classification: null, failedStep: null, reason: second.reason };
  if (second.state === "passed") {
    return { state: "needs_review", classification: "flaky", failedStep: null, reason: `Runs disagreed. First: ${first.state}, ${first.reason} Second: ${second.state}, ${second.reason}` };
  }
  // One failed, the other errored: a single failure is not enough to file a bug.
  const failed = first.state === "failed" ? first : second;
  return { state: "needs_review", classification: "flaky", failedStep: null, reason: `Failed once, the other run had no verdict. ${failed.reason}` };
}

function fromOne(v: Verdict): Final {
  if (v.state === "errored") return { state: "errored", classification: v.cause, failedStep: null, reason: v.reason };
  return { state: "needs_review", classification: "flaky", failedStep: null, reason: `Failed once, not confirmed. ${v.reason}` };
}

/** One run errored and the other failed: neither confirms anything, so a third run settles it. */
export const needsThirdRun = (a: Verdict, b: Verdict) => (a.state === "errored") !== (b.state === "errored") && (a.state === "failed" || b.state === "failed");

/** Errors are not answers. With three runs, the first two that answered are the ones compared. */
export function reconcileThree(a: Verdict, b: Verdict, c: Verdict): Final {
  const answered = [a, b, c].filter((v) => v.state !== "errored");
  if (answered.length >= 2) return reconcile(answered[0], answered[1]);
  if (answered.length === 1) return reconcile(answered[0], null);
  return reconcile(b, c);
}
