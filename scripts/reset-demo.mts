// Usage: npx tsx --env-file=.env.local scripts/reset-demo.mts [trail number]
// Puts the app in a clean demo state: archives the database and replay files, deletes every run, check and bug report,
// and resolves the open findings on the Trail in Entire. Requirements, approvals, Brain memories and the compile cache stay.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";
import { closeDb, db } from "../lib/db";
import { resolveFinding } from "../lib/entire";

const trail = process.argv[2] ?? "4";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const archive = path.join("data", "archive", stamp);
mkdirSync(archive, { recursive: true });

// 1. A dump first, so nothing is lost for good.
const pgDump = ["/opt/homebrew/opt/postgresql@17/bin/pg_dump", "pg_dump"].find((p) => p === "pg_dump" || existsSync(p))!;
try {
  execFileSync(pgDump, ["--file", path.join(archive, "db.sql"), process.env.DATABASE_URL!]);
  console.log("database dumped to", archive);
} catch (e) {
  console.log("no database dump (pg_dump unavailable):", String(e).slice(0, 80));
}

// 2. Replay files out of the way.
if (existsSync("data/replays")) {
  mkdirSync(path.join(archive, "replays"), { recursive: true });
  for (const d of readdirSync("data/replays")) renameSync(path.join("data/replays", d), path.join(archive, "replays", d));
}

// 3. Runs and everything that hangs off them.
for (const q of [
  "delete from steps", "delete from bug_reports", "delete from checks", "delete from runs",
  "update trails set last_head_sha = null",
]) await db().query(q);
console.log("runs, checks and bug reports cleared");

// 4. Findings in Entire: all open ones, including any filed under an old marker.
const ref = { project: process.env.ENTIRE_PROJECT!, trail };
const list = JSON.parse(execFileSync("entire", ["trail", "finding", "list", "--json", "--project", ref.project, "--trail", trail], { cwd: process.env.TARGET_REPO_DIR, maxBuffer: 16 * 1024 * 1024 }).toString());
for (const f of list.findings as { id: string; status: string; body?: string }[]) {
  if (f.status !== "open") continue;
  await resolveFinding(f.id, "Reset for a clean demo run", ref);
  console.log("resolved", f.id, (f.body ?? "").split("\n")[0].slice(0, 70));
}
await closeDb();
