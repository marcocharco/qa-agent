// Spawns the orchestrator as a local child process and remembers it, so the dashboard can show progress
// before the first run row exists (extraction can take a while).
import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const exec = promisify(execFile);

type Job = { proc: ChildProcess; log: string[]; exitCode: number | null; startedAt: number };
// Survives Next's hot reloads in dev.
const g = globalThis as unknown as { __anchorfishJobs?: Map<string, Job>; __anchorfishNumbers?: Map<string, string> };
const jobs = (g.__anchorfishJobs ??= new Map());
const numbers = (g.__anchorfishNumbers ??= new Map());

export const missingEnv = () => ["ENTIRE_PROJECT", "TARGET_REPO_DIR", "TARGET_URL"].filter((k) => !process.env[k]);

/** The orchestrator takes a Trail number, the database stores the Entire id. */
export async function trailNumber(trailId: string): Promise<string> {
  const known = numbers.get(trailId);
  if (known) return known;
  const { stdout } = await exec("entire", ["trail", "show", trailId, "--project", process.env.ENTIRE_PROJECT!, "--json"], { maxBuffer: 16 * 1024 * 1024 });
  const n = String(JSON.parse(stdout).number);
  numbers.set(trailId, n);
  return n;
}

export function jobStatus(trailId: string) {
  const j = jobs.get(trailId);
  if (!j) return null;
  // The first line that says why a run went wrong (the last lines are only the summary).
  const bad = j.log.find((l: string) => /ERRORED|run failed|ApiError|credits/i.test(l));
  const clean = bad ? bad.replace(/^\d{2}:\d{2}:\d{2}\s+/, "") : null;
  const problem = !clean ? null
    : /credits are depleted|"code":\s*402/.test(clean) ? "Gemini is out of credits (402), so requirements cannot be turned into browser goals. Top up the project at AI Studio or use another key."
    : /429|quota|RESOURCE_EXHAUSTED/.test(clean) ? "Gemini is rate limited or over quota. Try again in a minute or use another key."
    : clean.slice(0, 240);
  return { running: j.exitCode === null, exitCode: j.exitCode, log: j.log.slice(-6), problem };
}

export async function startRun(trailId: string) {
  if (jobs.get(trailId)?.exitCode === null) return;
  const number = await trailNumber(trailId);
  const proc = spawn("npx", ["tsx", "--env-file=.env.local", "scripts/orchestrate.mts", number], { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  const job: Job = { proc, log: [], exitCode: null, startedAt: Date.now() };
  const push = (l: string) => { job.log.push(l); if (job.log.length > 200) job.log.shift(); };
  createInterface({ input: proc.stdout! }).on("line", push);
  createInterface({ input: proc.stderr! }).on("line", push);
  proc.on("exit", (code) => { job.exitCode = code ?? 1; });
  proc.on("error", (e) => { push(String(e)); job.exitCode = 1; });
  jobs.set(trailId, job);
}
