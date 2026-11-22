// Usage: npx tsx --env-file=.env.local scripts/demo-state.mts save <name> | restore <name> [trail number] | list
// Saves the app's current run (runs, checks, steps, bug reports and the replay files) so a good run can be put back in one
// command before a demo, and re-files the matching findings in Entire so the merge gate agrees with what the dashboard shows.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { closeDb, db } from "../lib/db";
import { addFinding, postSummary, resolveFinding } from "../lib/entire";
import { runTotals } from "../lib/orchestrator";
import { recommend } from "../lib/recommendation";

const [cmd, name = "demo", trail = "4"] = process.argv.slice(2);
const root = path.join("data", "demo-state");
const bin = (b: string) => (existsSync(`/opt/homebrew/opt/postgresql@17/bin/${b}`) ? `/opt/homebrew/opt/postgresql@17/bin/${b}` : b);
const TABLES = ["runs", "checks", "steps", "bug_reports"];

if (cmd === "list") {
  console.log(existsSync(root) ? readdirSync(root).join("\n") || "(none)" : "(none)");
} else if (cmd === "save") {
  const dir = path.join(root, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execFileSync(bin("pg_dump"), ["--data-only", "--file", path.join(dir, "db.sql"), ...TABLES.flatMap((t) => ["--table", t]), process.env.DATABASE_URL!]);
  if (existsSync("data/replays")) cpSync("data/replays", path.join(dir, "replays"), { recursive: true });
  const n = (await db().query("select (select count(*) from runs) r, (select count(*) from checks) c")).rows[0];
  console.log(`saved "${name}": ${n.r} run(s), ${n.c} check(s)`);
} else if (cmd === "restore") {
  const dir = path.join(root, name);
  if (!existsSync(path.join(dir, "db.sql"))) throw new Error(`no saved state called "${name}"`);
  for (const t of ["steps", "bug_reports", "checks", "runs"]) await db().query(`delete from ${t}`);
  execFileSync(bin("psql"), ["--quiet", "--file", path.join(dir, "db.sql"), process.env.DATABASE_URL!], { stdio: "pipe" });
  rmSync("data/replays", { recursive: true, force: true });
  if (existsSync(path.join(dir, "replays"))) cpSync(path.join(dir, "replays"), "data/replays", { recursive: true });

  // Entire: close whatever is open, then file one finding per confirmed failure, as a run would have.
  const ref = { project: process.env.ENTIRE_PROJECT!, trail };
  const list = JSON.parse(execFileSync("entire", ["trail", "finding", "list", "--json", "--project", ref.project, "--trail", trail], { cwd: process.env.TARGET_REPO_DIR, maxBuffer: 16 * 1024 * 1024 }).toString());
  for (const f of list.findings as { id: string; status: string }[]) if (f.status === "open") await resolveFinding(f.id, "Demo state restored", ref);
  const failed = (await db().query(`select c.id, c.reason, c.failed_step, r.id as rid, r.text, r.status from checks c join requirements r on r.id = c.requirement_id where c.passed = false and c.run_id = (select id from runs order by started_at desc limit 1)`)).rows;
  for (const f of failed) {
    const id = await addFinding(f.rid, f.text, `Failed at step ${f.failed_step}: ${f.reason}`, ref, f.status === "approved" ? "high" : "low");
    await db().query("update bug_reports set finding_id = $2 where check_id = $1", [f.id, id]);
    console.log("filed finding for:", f.text.slice(0, 70));
  }
  const run = (await db().query("select id from runs order by started_at desc limit 1")).rows[0];
  if (run) {
    const t = await runTotals(run.id);
    const rec = recommend({ total: t.passed + t.failed + t.review + t.errored, passed: t.passed, failed: t.failed, needsReview: t.review, errored: t.errored, failures: t.failures });
    await postSummary(rec.text, ref);
  }
  console.log(`restored "${name}"`);
} else {
  console.log("usage: demo-state.mts save <name> | restore <name> [trail] | list");
}
await closeDb();
