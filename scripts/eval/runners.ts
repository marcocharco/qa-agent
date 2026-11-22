// The two systems under test, behind one interface. Each gets the same task text and a URL, and answers pass, fail or none,
// with what it says it saw, what it cost and how long it took.
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { reconcile } from "../../lib/confirm";
import { runFeature } from "../../lib/tinyfish";
import { saveReplay } from "../../lib/replay";
import { gaveNoVerdict, toFeatureVerdicts, type Verdict } from "../../lib/verdict";
import { verifyPass } from "../../lib/verifyPass";

const exec = promisify(execFile);

export type Task = { id: string; text: string; goal: string };
export type Outcome = {
  verdict: "pass" | "fail" | "none";
  /** What the agent says it saw (verbatim text from the page). */
  observed: string;
  reason: string;
  credits: number;
  seconds: number;
  /** Anything worth knowing about how the answer was reached. */
  detail: Record<string, unknown>;
};
export interface Runner { name: string; run(task: Task, url: string): Promise<Outcome> }

const TINYFISH_PER_STEP = 0.016;

const observedOf = (result: Record<string, unknown> | null): string => {
  const r = (result as { results?: { observed?: string }[] } | null)?.results?.[0];
  return r?.observed ?? "";
};

/** ArcherFish's own pipeline for one check: strict browser run, rerun on no answer, confirming run, screenshot check on passes. */
export const archerfish: Runner = {
  name: "archerfish",
  async run(task, url) {
    const t0 = Date.now();
    let credits = 0, sessions = 0;
    const session = async () => {
      let run = await runFeature(task.goal, url, 1);
      let n = 1;
      sessions++;
      let replay = run.runId ? await saveReplay(run.runId).catch(() => null) : null;
      credits += (replay?.steps.length ?? run.steps.length) * TINYFISH_PER_STEP;
      // An empty answer says nothing about the page: run it again, at most twice.
      while (n <= 2 && gaveNoVerdict(run, 1)) {
        run = await runFeature(task.goal, url, 1);
        replay = run.runId ? await saveReplay(run.runId).catch(() => null) : null;
        credits += (replay?.steps.length ?? run.steps.length) * TINYFISH_PER_STEP;
        sessions++; n++;
      }
      let v: Verdict = toFeatureVerdicts(run, 1)[0];
      // A pass is only believed if the last screenshot does not contradict what the agent says it saw.
      const file = [...(replay?.steps ?? [])].reverse().find((s) => s.file)?.file ?? null;
      v = await verifyPass(v, file, v.reason);
      credits += 0.001; // one small Gemini vision call
      return { v, run };
    };
    const first = await session();
    const second = first.v.state === "passed" ? null : await session();
    const final = reconcile(first.v, second?.v ?? null);
    const last = second?.run ?? first.run;
    return {
      verdict: final.state === "passed" ? "pass" : final.state === "failed" ? "fail" : "none",
      observed: observedOf(last.result), reason: final.reason, credits, seconds: (Date.now() - t0) / 1000,
      detail: { state: final.state, classification: final.classification, sessions, runIds: [first.run.runId, second?.run.runId] },
    };
  },
};

const FINAL_ANSWER = `

When you have finished, reply with ONLY one JSON object and nothing else, in exactly this shape:
{"results":[{"check":1,"passed":true,"failed_step":null,"observed":"the exact visible text you read","reason":"one sentence"}]}`;

const MCP_BIN = process.env.CHROME_DEVTOOLS_MCP ?? path.join(os.homedir(), ".npm/_npx/053a863a8198098a/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js");

/** A general Claude agent in a real Chrome (Chrome DevTools MCP), given the same task. Cost is what Claude Code itself reports. */
export const claudeAgent: Runner = {
  name: "claude",
  async run(task, url) {
    const t0 = Date.now();
    const dir = await mkdtemp(path.join(os.tmpdir(), "claude-eval-"));
    try {
      const mcp = path.join(dir, "mcp.json");
      await writeFile(mcp, JSON.stringify({ mcpServers: { "chrome-devtools": { command: "node", args: [MCP_BIN, "--headless", "--isolated"] } } }));
      const prompt = `Use the browser tools to open ${url} and carry out this test.\n\n${task.goal}${FINAL_ANSWER}`;
      const cleanPath = (process.env.PATH ?? "").split(":").filter((p) => !/rex/i.test(p)).join(":");
      const args = ["-p", "--output-format", "json", "--strict-mcp-config", "--mcp-config", mcp, "--allowedTools", "mcp__chrome-devtools", "--disable-slash-commands", "--max-budget-usd", "2"];
      if (process.env.EVAL_CLAUDE_MODEL) args.push("--model", process.env.EVAL_CLAUDE_MODEL);
      let out: { result?: string; total_cost_usd?: number; num_turns?: number; is_error?: boolean; modelUsage?: Record<string, unknown> };
      try {
        const child = exec("claude", args, { cwd: dir, env: { ...process.env, PATH: cleanPath, REX_SERVER: "", REX_SESSION: "", REX_BLOCK: "" }, maxBuffer: 64 * 1024 * 1024, timeout: 900_000 });
        child.child.stdin?.end(prompt);
        out = JSON.parse((await child).stdout);
      } catch (e) {
        const stdout = (e as { stdout?: string }).stdout;
        try { out = JSON.parse(stdout ?? ""); } catch { return { verdict: "none", observed: "", reason: `claude failed: ${String(e).slice(0, 160)}`, credits: 0, seconds: (Date.now() - t0) / 1000, detail: { error: true } }; }
      }
      // The agent's last message must contain the JSON answer. Parse it the same way for both arms.
      const text = out.result ?? "";
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      let result: Record<string, unknown> | null = null;
      try { result = json ? JSON.parse(json) : null; } catch { result = null; }
      const v = toFeatureVerdicts({ status: out.is_error ? "FAILED" : "COMPLETED", error: null, result }, 1)[0];
      return {
        verdict: v.state === "passed" ? "pass" : v.state === "failed" ? "fail" : "none",
        observed: observedOf(result), reason: v.reason, credits: out.total_cost_usd ?? 0, seconds: (Date.now() - t0) / 1000,
        detail: { turns: out.num_turns, models: Object.keys(out.modelUsage ?? {}) },
      };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  },
};
