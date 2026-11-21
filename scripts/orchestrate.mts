// Usage: npx tsx --env-file=.env.local scripts/orchestrate.mts <trail-number> [--watch]
// One run now, or with --watch: run again on every new push to the Trail's branch.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { closeDb } from "../lib/db";
import { geminiModel } from "../lib/gemini";
import { needsRun, processTrail, type Config } from "../lib/orchestrator";

const need = (k: string) => process.env[k] ?? (() => { throw new Error(`${k} is not set`); })();
const trail = process.argv[2];
if (!trail) throw new Error("usage: orchestrate.mts <trail-number> [--watch]");
const cfg: Config = {
  project: need("ENTIRE_PROJECT"),
  repoDir: need("TARGET_REPO_DIR"),
  targetUrl: need("TARGET_URL"),
  concurrency: Number(process.env.CONCURRENCY ?? 4),
  model: geminiModel(),
  log: (m) => console.log(new Date().toISOString().slice(11, 19), m),
};
const ref = { project: cfg.project, trail };

let busy = false;
let again = false;
async function runIfNew(force = false) {
  if (busy) return void (again = true);
  busy = true;
  try {
    if (force || (await needsRun(cfg, ref))) console.log(await processTrail(cfg, ref));
  } catch (e) {
    console.error("run failed:", e);
  } finally {
    busy = false;
    if (again) { again = false; void runIfNew(); }
  }
}

await runIfNew(true);
if (process.argv.includes("--watch")) {
  const w = spawn("entire", ["trail", "watch", trail, "--project", cfg.project, "--json"], { stdio: ["ignore", "pipe", "inherit"] });
  let timer: NodeJS.Timeout | undefined;
  createInterface({ input: w.stdout }).on("line", () => {
    clearTimeout(timer);
    timer = setTimeout(() => void runIfNew(), 5000);
  });
  cfg.log?.(`watching Trail ${trail}`);
} else await closeDb();
