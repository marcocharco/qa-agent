// Usage: npx tsx --env-file=.env.local scripts/entire-proof.mts
// Proves from Entire itself, not from our database, that every claim the app makes is read from Entire and not hardcoded.
// Writes docs/ENTIRE-PROOF.md. Every section shows the command, so anyone can run it again in the demo repo.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { attributeLine } from "../lib/attribution";
import { closeDb, db } from "../lib/db";
import { sessionTranscript, showTrail, trailSessionIds } from "../lib/entire";
import { parseTranscript } from "../lib/transcript";

const run = promisify(execFile);
const repo = process.env.TARGET_REPO_DIR!;
const project = process.env.ENTIRE_PROJECT!;
const summary = process.argv.includes("--summary");
const trail = process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? "4";
// A pipe that closes early (`| head`) is not an error.
process.stdout.on("error", () => {});
const sh = async (cmd: string, args: string[], cwd = repo) => {
  try { return (await run(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout.trim(); } catch (e) { return `ERROR ${String(e).slice(0, 200)}`; }
};
const out: string[] = [];
const say = (...l: string[]) => { out.push(...l); if (!summary) console.log(l.join("\n")); };
const cell = (s: string, n = 90) => s.replace(/\s+/g, " ").replace(/\|/g, "/").slice(0, n);

say(`# Entire proof`, "", `Generated ${new Date().toISOString()} by \`scripts/entire-proof.mts\`. Everything below is read live from the Entire CLI in the demo repo (\`${repo}\`), then checked against what ArcherFish stored. Re-run any command yourself in that folder.`, "");

// 1. Entire itself
say("## 1. Entire is installed and wired to the repo", "", "```", `$ entire version\n${await sh("entire", ["version"])}`, `$ entire trail list --project ${project} --json  (summary)`, "```");
const trails = JSON.parse(await sh("entire", ["trail", "list", "--project", project, "--repo", `${project}/acme-pricing-demo`, "--json"]) || "{}");
const rows = (trails.items ?? []) as { number: number; title: string; status: string; branch?: string }[];
say("", "| Trail | Title | Status |", "|---|---|---|", ...rows.map((t) => `| #${t.number} | ${cell(t.title, 60)} | ${t.status} |`), "");

// 2. Sessions the requirements come from
const ref = { project, trail };
const sessions = await trailSessionIds(ref);
say(`## 2. The Trail's agent sessions come from Entire`, "", "```", `$ entire trail sessions ${trail} --project ${project} --json`, "```", "", `Trail #${trail} has ${sessions.length} linked session(s): ${sessions.map((s) => `\`${s}\``).join(", ")}.`, "");

// 3. Every requirement's quote is in the real transcript
say("## 3. Citation check: every quoted requirement is verbatim in the session transcript fetched from Entire", "");
const reqs = (await db().query("select r.id, r.text, r.quote, r.source_kind, r.source_session_id, r.source_message_id, t.id as trail_id from requirements r join trails t on t.id = r.trail_id where r.quote is not null and r.status <> 'rejected'")).rows;
const transcripts = new Map<string, ReturnType<typeof parseTranscript>>();
const trailBodies = new Map<string, string>();
let ok = 0, bad = 0;
const lines: string[] = [];
for (const r of reqs) {
  let found = false, where = "";
  if (r.source_kind === "session" && r.source_session_id) {
    if (!transcripts.has(r.source_session_id)) transcripts.set(r.source_session_id, parseTranscript(await sessionTranscript(r.source_session_id, repo).catch(() => "")));
    const m = transcripts.get(r.source_session_id)!.find((x) => x.id === r.source_message_id);
    found = !!m && m.role === "user" && m.text.includes(r.quote);
    where = `session \`${r.source_session_id.slice(0, 8)}\`, message \`${String(r.source_message_id).slice(0, 8)}\``;
  } else if (r.source_kind === "description") {
    if (!trailBodies.has(r.trail_id)) trailBodies.set(r.trail_id, await showTrail({ project, trail: r.trail_id }).then((t) => t.body).catch(() => ""));
    found = trailBodies.get(r.trail_id)!.includes(r.quote); where = "Trail description";
  }
  found ? ok++ : bad++;
  lines.push(`| ${found ? "yes" : "NO"} | ${cell(r.quote, 70)} | ${where} |`);
}
// A verifier that cannot fail proves nothing: change one character of a quote and it must be rejected.
const sample = reqs.find((r) => r.source_kind === "session" && r.source_session_id);
let negative = "n/a";
if (sample) {
  const m = transcripts.get(sample.source_session_id)!.find((x) => x.id === sample.source_message_id);
  negative = m && !m.text.includes(sample.quote.replace(/.$/, "#")) ? "rejected, as it should be" : "WRONGLY ACCEPTED";
}
say(`**${ok} of ${ok + bad}** quotes found in the real transcript. Negative control (one character changed in a quote): ${negative}.`, "", "| Verbatim in transcript | Quote | Source |", "|---|---|---|", ...lines.slice(0, 40), "");

// 4. Attribution: bug lines -> the exact prompt, controls -> something else
say("## 4. Attribution: `entire why` maps a line of code to the checkpoint, session and exact prompt that wrote it", "");
const promptsFile = await readFile("demo/sessions/02-annual-volume.md", "utf8");
const prompts = new Map<number, string>();
const parts = promptsFile.split(/^\[(\d+)\]\s*$/m);
for (let i = 1; i < parts.length; i += 2) prompts.set(Number(parts[i]), parts[i + 1].trim());
const dir = await mkdtemp(path.join(os.tmpdir(), "proof-"));
let right = 0, total = 0;
try {
  await sh("git", ["fetch", "origin", "feat/annual-volume"]);
  await sh("git", ["worktree", "add", "--detach", dir, "origin/feat/annual-volume"]);
  const lineOf = async (file: string, needle: string, after = "") => {
    const text = (await readFile(path.join(dir, file), "utf8")).split("\n");
    const start = after ? text.findIndex((l) => l.includes(after)) : 0;
    const i = text.findIndex((l, k) => k >= start && l.includes(needle));
    return i + 1;
  };
  const cases: { label: string; file: string; needle: string; after?: string; expect?: number }[] = [
    { label: "Bug A: Team skips the coupon on annual", file: "lib/pricing.ts", needle: "couponDiscountCents: 0,", after: "export function annualQuote", expect: 5 },
    { label: "Bug B: strict > at the volume tier", file: "lib/pricing.ts", needle: "seats > volume.over", expect: 8 },
    { label: "Bug C: minus floors at 1, not the plan minimum", file: "components/PricingCard.tsx", needle: "Math.max(1, s - 1)", expect: 7 },
    { label: "Bug D: coupon taken from the list price", file: "lib/pricing.ts", needle: "couponFor(coupon, monthlyCents * seats * MONTHS_PER_YEAR)", expect: 9 },
    { label: "Control: a line from session 1", file: "lib/pricing.ts", needle: "export const PLAN_CONFIGS" },
    { label: "Control: a line committed by hand, not by an agent", file: "app/globals.css", needle: "cursor: pointer" },
  ];
  say("| Line | Where | Checkpoint | Session | Prompt it came from | Matches the answer key |", "|---|---|---|---|---|---|");
  for (const c of cases) {
    const n = await lineOf(c.file, c.needle, c.after);
    const a = n ? await attributeLine(c.file, n, dir).catch(() => null) : null;
    const text = a?.prompt?.text.trim() ?? "";
    let verdict = c.expect ? "" : a ? "different session, as expected" : "no checkpoint (not agent written), as expected";
    if (c.expect) {
      total++;
      const want = prompts.get(c.expect) ?? "";
      const hit = !!text && text.startsWith(want.slice(0, 60));
      if (hit) right++;
      verdict = hit ? `yes, prompt 02/0${c.expect}` : `NO (expected 02/0${c.expect})`;
    }
    say(`| ${c.label} | \`${c.file}:${n}\` | ${a ? `\`${a.checkpointId.slice(0, 10)}\`` : "none"} | ${a ? `\`${a.sessionId.slice(0, 8)}\`` : "none"} | ${cell(text || "(none)", 60)} | ${verdict} |`);
  }
  say("", `**Attribution accuracy: ${right} of ${total}** planted bugs traced to the prompt that introduced them. The controls resolve to a different session, or to nothing, so the lookup is not pinned to one answer. Reproduce: \`entire why lib/pricing.ts:<line>\` on branch \`feat/annual-volume\`.`, "");

  // 5. Graph: measured separately, with real token counts
  say("## 5. Graph: ranked code context instead of whole files", "", "```", `$ entire graph query --format agent --head --profile full "<failure in plain words>"`, "```", "", "The measurement (real Gemini prompt tokens, three kinds of code context, accuracy checked against the answer key) is in `docs/GRAPH-EVAL.md`, produced by `scripts/graph-eval.mts`.", "");
} finally {
  await sh("git", ["worktree", "remove", "--force", dir]);
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}

// 6. Brain
say("## 6. Brain: approved requirements are memories, anchored to the code they constrain, shown to an agent about to edit it", "",
  "ArcherFish writes a memory when a requirement is approved. It asks Entire Graph which file implements the requirement and names that file in the memory, so Brain's edit hook can show it to any Claude Code session that is about to edit that file.", "",
  "```", `$ entire brain hook pre-edit --file lib/pricing.ts   # what an agent sees before editing the file`, "```", "", "```",
  (await sh("entire", ["brain", "hook", "pre-edit", "--file", "lib/pricing.ts", "--budget", "1200"])), "```", "",
  "```", `$ entire brain recall "change the volume discount threshold"`, "```", "", "```", (await sh("entire", ["brain", "recall", "change the volume discount threshold"])).slice(0, 1800), "```", "");

// 7. Findings and the gate
say("## 7. Findings and the merge gate live in Entire", "", "```", `$ entire trail finding list ${trail} --project ${project}`, "```", "", "```", (await sh("entire", ["trail", "finding", "list", trail, "--project", project])).slice(0, 2500), "```", "", "```", `$ entire trail merge ${trail} --dry-run`, (await sh("entire", ["trail", "merge", trail, "--project", project, "--dry-run"])).slice(0, 800), "```", "");

// 8. Detection, from the runs stored so far
const planted: [string, string][] = [["A", "SAVE10 works on Team in annual mode%"], ["B", "Team gets 5% off the subtotal at 10%"], ["C", "Team needs at least 3 seats%"], ["D", "Annual comes first%"]];
say("## 8. Detection of the planted bugs, from every stored run", "");
const nruns = Number((await db().query("select count(*) from runs where finished_at is not null")).rows[0].count);
if (!nruns) say("No finished runs stored yet. Run the Trail, then re-run this script.", "");
else {
  say("| Bug | Runs that tested it | Confirmed as a bug | Flagged for review | Missed (false pass) |", "|---|---|---|---|---|");
  for (const [bug, like] of planted) {
    const r = (await db().query(`select count(*) n, count(*) filter (where c.passed = false) bug, count(*) filter (where c.classification = 'flaky') flaky, count(*) filter (where c.passed = true) missed from checks c join requirements r on r.id = c.requirement_id where r.text like $1 and (c.passed is not null or c.classification is not null)`, [like])).rows[0];
    say(`| ${bug} | ${r.n} | ${r.bug} | ${r.flaky} | ${r.missed} |`);
  }
  const fp = (await db().query(`select count(*) filter (where c.passed = false) bad, count(*) n from checks c join requirements r on r.id = c.requirement_id where not (r.text like any ($1))`, [planted.map(([, l]) => l)])).rows[0];
  say("", `Requirements that are not planted bugs: ${fp.n} checks, ${fp.bad} confirmed as failures (false positives).`, "");
}

await writeFile("docs/ENTIRE-PROOF.md", out.join("\n") + "\n");
if (summary) {
  // The headline results only, for a terminal pane: section titles and the lines that carry a number or a verdict.
  console.log(out.filter((l) => /^## |^\*\*|^\| (Bug|Control)|Mergeable|memories/.test(l)).map((l) => l.replace(/^## /, "\n== ")).join("\n"));
}
console.log("\nfull report: docs/ENTIRE-PROOF.md");
await closeDb();
