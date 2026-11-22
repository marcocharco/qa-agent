// Usage: npx tsx --env-file=.env.local scripts/eval/dev-session.mts [buggy|fixed] [--no-list]
// --no-list: the session is only told to check that the feature works, with no list of requirements.
// The spot check: the developer's own Claude Code session, in a checkout of the branch, is handed the same requirements
// and asked to test the live page in a browser. Timed, with the cost Claude Code reports. One run, not a statistic.
import { execFile } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { closeDb, db } from "../../lib/db";

const run = promisify(execFile);
const build = process.argv[2] ?? "buggy";
const gt = JSON.parse(readFileSync("eval/ground-truth.json", "utf8"));
const url = gt.builds[build] as string;
const branch = build === "buggy" ? "origin/feat/annual-volume" : "origin/feat/annual-volume-fixed";
const repo = process.env.TARGET_REPO_DIR!;
const reqs = (await db().query("select text from requirements where status='approved' and testable order by text")).rows.map((r) => r.text as string);
await closeDb();

const dir = await mkdtemp(path.join(os.tmpdir(), "devsession-"));
const work = path.join(dir, "repo");
try {
  await run("git", ["worktree", "add", "--detach", work, branch], { cwd: repo });
  const mcp = path.join(dir, "mcp.json");
  const bin = process.env.CHROME_DEVTOOLS_MCP ?? path.join(os.homedir(), ".npm/_npx/053a863a8198098a/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js");
  await writeFile(mcp, JSON.stringify({ mcpServers: { "chrome-devtools": { command: "node", args: [bin, "--headless", "--isolated"] } } }));
  const noList = process.argv.includes("--no-list");
  const prompt = noList ? `You just built the annual billing and volume pricing feature in this repo, and it is deployed at ${url}.
Check in a real browser that the feature works. Do not change any code. Tell me what works and what is broken, with what you saw on the page.` : `You just built the annual billing and volume pricing feature in this repo, and it is deployed at ${url}.
Test it in a real browser against these requirements, then tell me which pass and which fail. Do not change any code.

${reqs.map((r, i) => `${i + 1}. ${r}`).join("\n")}

For each requirement, give pass or fail and what you actually saw on the page.`;
  const cleanPath = (process.env.PATH ?? "").split(":").filter((p) => !/rex/i.test(p)).join(":");
  const t0 = Date.now();
  const child = run("claude", ["-p", "--output-format", "json", "--strict-mcp-config", "--mcp-config", mcp, "--allowedTools", "mcp__chrome-devtools,Read,Grep,Glob", "--disable-slash-commands", "--max-budget-usd", "5"], { cwd: work, env: { ...process.env, PATH: cleanPath, REX_SERVER: "", REX_SESSION: "", REX_BLOCK: "" }, maxBuffer: 64 * 1024 * 1024, timeout: 1_800_000 });
  child.child.stdin?.end(prompt);
  const out = JSON.parse((await child).stdout);
  const seconds = (Date.now() - t0) / 1000;
  console.log(out.result);
  console.log(`\n--- ${build}: ${seconds.toFixed(0)}s, $${(out.total_cost_usd ?? 0).toFixed(3)}, ${out.num_turns} turns, ${Object.keys(out.modelUsage ?? {}).join(",")}`);
  appendFileSync("data/eval/dev-sessions.jsonl", JSON.stringify({ ts: new Date().toISOString(), build, noList, seconds, cost: out.total_cost_usd, turns: out.num_turns, requirements: reqs.length, result: out.result }) + "\n");
} finally {
  await run("git", ["worktree", "remove", "--force", work], { cwd: repo }).catch(() => {});
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}
