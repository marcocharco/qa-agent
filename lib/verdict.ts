import { z } from "zod";

/** What a browser backend (TinyFish, later a Claude agent) hands back for one check. */
export type RunnerOutcome = {
  status: string;
  error: string | null;
  result: Record<string, unknown> | null;
};

export type Verdict =
  | { state: "passed"; failedStep: null; reason: string }
  | { state: "failed"; failedStep: number | null; reason: string }
  /** The run produced no trustworthy verdict. Never a pass, never a bug finding. */
  | { state: "errored"; failedStep: null; reason: string; cause: "environment" | "test_problem" };

const agentVerdict = z.object({
  passed: z.boolean(),
  failed_step: z.number().int().nullable(),
  reason: z.string(),
});

/** The agent's own verdict decides pass or fail, never the run status. */
export function toVerdict(o: RunnerOutcome): Verdict {
  if (o.status !== "COMPLETED") {
    return { state: "errored", failedStep: null, reason: `Run ${o.status}: ${o.error ?? "no details"}`, cause: "environment" };
  }
  const parsed = agentVerdict.safeParse(o.result);
  if (!parsed.success) {
    return { state: "errored", failedStep: null, reason: "The agent returned no valid verdict", cause: "test_problem" };
  }
  const v = parsed.data;
  return v.passed
    ? { state: "passed", failedStep: null, reason: v.reason }
    : { state: "failed", failedStep: v.failed_step, reason: v.reason };
}

const featureOutput = z.object({
  results: z.array(
    z.object({
      check: z.number().int(),
      passed: z.boolean(),
      failed_step: z.number().int().nullable(),
      /** Verbatim visible text the agent saw. A pass without it is not trusted (the agent may echo the expectation). */
      observed: z.string(),
      reason: z.string(),
    }),
  ),
});

/** One verdict per check (1-based) from a single browser session that ran `count` checks in order. */
export function toFeatureVerdicts(o: RunnerOutcome, count: number): Verdict[] {
  const errored = (reason: string, cause: "environment" | "test_problem" = "test_problem"): Verdict => ({ state: "errored", failedStep: null, reason, cause });
  if (o.status !== "COMPLETED") return Array.from({ length: count }, () => errored(`Run ${o.status}: ${o.error ?? "no details"}`, "environment"));
  const parsed = featureOutput.safeParse(o.result);
  if (!parsed.success) return Array.from({ length: count }, () => errored("The agent returned no valid verdict"));
  return Array.from({ length: count }, (_, i) => {
    const r = parsed.data.results.find((x) => x.check === i + 1);
    if (!r) return errored(`The agent reported no result for check ${i + 1}`);
    if (r.passed && !r.observed.trim()) return errored("The agent passed this check without quoting what it saw");
    const reason = r.observed.trim() ? `${r.reason} Saw: ${r.observed.trim()}` : r.reason;
    return r.passed ? { state: "passed", failedStep: null, reason } : { state: "failed", failedStep: r.failed_step, reason };
  });
}

/** The session ended with nothing usable for any check (an empty answer, or a run that failed with no details): a harness failure, not a result about the site. */
export const gaveNoVerdict = (o: RunnerOutcome, count: number) =>
  toFeatureVerdicts(o, count).every((v) => v.state === "errored");
