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
  | { state: "errored"; failedStep: null; reason: string };

const agentVerdict = z.object({
  passed: z.boolean(),
  failed_step: z.number().int().nullable(),
  reason: z.string(),
});

/** The agent's own verdict decides pass or fail, never the run status. */
export function toVerdict(o: RunnerOutcome): Verdict {
  if (o.status !== "COMPLETED") {
    return { state: "errored", failedStep: null, reason: `Run ${o.status}: ${o.error ?? "no details"}` };
  }
  const parsed = agentVerdict.safeParse(o.result);
  if (!parsed.success) {
    return { state: "errored", failedStep: null, reason: "The agent returned no valid verdict" };
  }
  const v = parsed.data;
  return v.passed
    ? { state: "passed", failedStep: null, reason: v.reason }
    : { state: "failed", failedStep: v.failed_step, reason: v.reason };
}
