// Usage: npx tsx --env-file=.env.local scripts/eval/run.mts [repeats] [--smoke] [--arm archerfish|claude] [--only A,B] [--concurrency 5]
// Runs every task on both builds with each system, five at a time, and appends one line per run to data/eval/runs.jsonl.
// A run that fails is recorded as "none" and the eval carries on. Re-running skips what is already in the log.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { closeDb, db } from "../../lib/db";
import { renderFeatureGoal } from "../../lib/compile";
import { archerfish, claudeAgent, type Outcome, type Runner, type Task } from "./runners";

const args = process.argv.slice(2);
const flag = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const repeats = Number(args.find((a) => /^\d+$/.test(a)) ?? 1);
const smoke = args.includes("--smoke");
const concurrency = Number(flag("--concurrency") ?? 5);
const only = flag("--only")?.split(",");
const armNames = flag("--arm") ? [flag("--arm")!] : ["archerfish", "claude"];
const arms: Runner[] = [archerfish, claudeAgent].filter((r) => armNames.includes(r.name));

const gt = JSON.parse(readFileSync("eval/ground-truth.json", "utf8"));
const builds: [string, string][] = Object.entries(gt.builds as Record<string, string>).filter(([b]) => !smoke || b === "buggy");
mkdirSync("data/eval", { recursive: true });
const LOG = "data/eval/runs.jsonl";
const done = new Set<string>(existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.arm}|${r.build}|${r.task}|${r.rep}`; }) : []);
const issue = (sev: string, msg: string) => appendFileSync("data/eval/issues.md", `- [${sev}] ${new Date().toISOString()} ${msg}\n`);

// The tasks: the compiled checks already in the database, so neither system pays to build its task.
const tasks: (Task & { expect: Record<string, string>; evidence: Record<string, string[]> })[] = [];
for (const t of gt.tasks as { id: string; match: string; expect: Record<string, string>; evidence: Record<string, string[]> }[]) {
  if (only && !only.includes(t.id)) continue;
  const row = (await db().query("select text, compiled from requirements where text like $1 and status = 'approved' and compiled is not null limit 1", [t.match])).rows[0];
  if (!row?.compiled?.spec) { issue("blocker", `task ${t.id} (${t.match}) has no compiled spec; run the Trail once so the checks are compiled`); continue; }
  tasks.push({ id: t.id, text: row.text, goal: renderFeatureGoal([row.compiled.spec]), expect: t.expect, evidence: t.evidence });
}
await closeDb();
if (!tasks.length) { console.log("no tasks, see data/eval/issues.md"); process.exit(1); }

const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);

for (const arm of arms) {
  const plan = shuffle(tasks.flatMap((t) => builds.flatMap(([build, url]) => Array.from({ length: repeats }, (_, rep) => ({ t, build, url, rep }))))).filter(({ t, build, rep }) => !done.has(`${arm.name}|${build}|${t.id}|${rep}`));
  console.log(`${arm.name}: ${plan.length} runs to do (${concurrency} at a time)`);
  const start = Date.now();
  let finished = 0;
  const queue = [...plan];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      const { t, build, url, rep } = j;
      let o: Outcome;
      try { o = await arm.run(t, url); } catch (e) {
        o = { verdict: "none", observed: "", reason: `runner threw: ${String(e).slice(0, 160)}`, credits: 0, seconds: 0, detail: { threw: true } };
        issue("error", `${arm.name} ${build} ${t.id}: ${String(e).slice(0, 200)}`);
      }
      const expect = t.expect[build];
      const evidenceOk = o.observed ? t.evidence[build].some((s: string) => o.observed.includes(s)) : null;
      appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), arm: arm.name, build, task: t.id, rep, expect, ...o, correct: o.verdict === expect, evidenceOk }) + "\n");
      console.log(`${arm.name} ${build} ${t.id}#${rep}: ${o.verdict} (want ${expect}) $${o.credits.toFixed(3)} ${o.seconds.toFixed(0)}s [${++finished}/${plan.length}]`);
    }
  }));
  const wall = (Date.now() - start) / 1000;
  appendFileSync("data/eval/blocks.jsonl", JSON.stringify({ ts: new Date().toISOString(), arm: arm.name, runs: plan.length, wallSeconds: wall, concurrency }) + "\n");
  console.log(`${arm.name} block took ${wall.toFixed(0)}s`);
}
process.exit(0);
