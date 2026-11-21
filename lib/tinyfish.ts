import { TinyFish } from "@tiny-fish/sdk";
import type { RunnerOutcome } from "./verdict";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    passed: { type: "boolean" },
    failed_step: { type: "integer", nullable: true },
    reason: { type: "string" },
  },
  required: ["passed", "failed_step", "reason"],
};

export type CheckRun = RunnerOutcome & {
  runId: string | null;
  streamingUrl: string | null;
  /** The agent's own description of each action, in order. */
  steps: string[];
};

/** One strict-mode browser run. Streams so the live grid gets the streaming_url early. */
export async function runCheck(
  goal: string,
  url: string,
  hooks: { onStreamingUrl?: (u: string) => void } = {},
): Promise<CheckRun> {
  const client = new TinyFish();
  const run: CheckRun = { status: "FAILED", error: "Stream ended without a result", result: null, runId: null, streamingUrl: null, steps: [] };
  const stream = await client.agent.stream({
    url,
    goal,
    agent_config: { mode: "strict", max_steps: 40, max_duration_seconds: 300 },
    output_schema: OUTPUT_SCHEMA,
    capture_config: { screenshots: true, recording: true },
  });
  for await (const e of stream) {
    if (e.type === "STARTED") run.runId = e.run_id;
    else if (e.type === "STREAMING_URL") {
      run.streamingUrl = e.streaming_url;
      hooks.onStreamingUrl?.(e.streaming_url);
    } else if (e.type === "PROGRESS") run.steps.push(e.purpose);
    else if (e.type === "COMPLETE") {
      run.runId = e.run_id;
      run.status = e.status;
      run.result = e.result;
      run.error = e.error?.message ?? null;
    }
  }
  return run;
}
