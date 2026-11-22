// Usage: npx tsx --env-file=.env.local scripts/nightly.mts
// Re-runs every active Trail (its own requirements plus the regression suite) against TARGET_URL and prints a
// morning summary. Failures are filed as findings like any run. Schedule it, for example with cron:
//   0 3 * * *  cd /path/to/archerfish && npx tsx --env-file=.env.local scripts/nightly.mts >> nightly.log 2>&1
import { closeDb } from "../lib/db";
import { activeTrailNumbers, showTrail } from "../lib/entire";
import { geminiModel } from "../lib/gemini";
import { processTrail, type Config } from "../lib/orchestrator";
import { recommend } from "../lib/recommendation";

const need = (k: string) => process.env[k] ?? (() => { throw new Error(`${k} is not set`); })();
const cfg: Config = {
  project: need("ENTIRE_PROJECT"),
  repoDir: need("TARGET_REPO_DIR"),
  targetUrl: need("TARGET_URL"),
  concurrency: Number(process.env.CONCURRENCY ?? 4),
  model: geminiModel(),
  log: (m) => console.log(new Date().toISOString().slice(11, 19), m),
};

const lines: string[] = [];
for (const n of await activeTrailNumbers(cfg.project)) {
  const ref = { project: cfg.project, trail: n };
  try {
    const title = (await showTrail(ref)).title;
    const r = await processTrail(cfg, ref);
    const rec = recommend({ total: r.passed + r.failed + r.needsReview + r.errored, ...r, failures: [] });
    lines.push(`Trail #${n} ${title}: ${r.passed} pass, ${r.failed} fail, ${r.needsReview} flaky, ${r.errored} no verdict. ${rec.verdict}`);
  } catch (e) {
    lines.push(`Trail #${n}: run failed, ${String(e).slice(0, 120)}`);
  }
}
console.log(`\nNightly regression, ${new Date().toDateString()}\n${lines.join("\n") || "No active Trails."}`);
await closeDb();
