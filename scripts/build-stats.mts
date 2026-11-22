// Usage: npx tsx scripts/build-stats.mts
// How ArcherFish itself was built, read from Entire: the sessions Entire tracked in this repo and their token usage
// (`entire session list --json`). Writes docs/BUILD-WITH-ENTIRE.md. Token counts are cumulative over every API call in a session.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

type S = { session_id: string; model: string; worktree_path: string; started_at: string; turns: number; checkpoints: number; tokens: { total: number; input: number; cache_read: number; cache_write: number; output: number }; last_prompt: string };
const sessions: S[] = JSON.parse(execFileSync("entire", ["session", "list", "--json"], { maxBuffer: 64 * 1024 * 1024 }).toString());
const sum = (k: keyof S["tokens"]) => sessions.reduce((n, s) => n + s.tokens[k], 0);
const M = (n: number) => `${(n / 1e6).toFixed(1)}M`;
const K = (n: number) => `${Math.round(n / 1e3)}k`;
const total = sum("total"), cacheRead = sum("cache_read");
const out = [
  "# How ArcherFish was built, from Entire", "",
  `Read live from \`entire session list --json\` (${new Date().toISOString().slice(0, 10)}). Entire tracked **${sessions.length} Claude Code sessions** in this project while we built it, across ${new Set(sessions.map((s) => s.worktree_path)).size} worktrees.`, "",
  "| Measure | Tokens |", "|---|---|",
  `| All tokens counted | ${M(total)} |`,
  `| of which re-read from cache | ${M(cacheRead)} (${Math.round((cacheRead / total) * 100)}%) |`,
  `| of which written to cache | ${M(sum("cache_write"))} |`,
  `| Fresh input | ${K(sum("input"))} |`,
  `| **Output the models wrote** | **${K(sum("output"))}** |`, "",
  "Read the totals carefully. Entire counts every token of every API call, and each call re-reads the whole conversation so far from the cache, so long sessions run into the hundreds of millions without that meaning hundreds of millions of tokens of new work. The number to quote for work done is output tokens. The number that shows why context matters is the cache share.", "",
  "| Session | Worktree | Turns | Checkpoints | Output | All tokens | First line of the last prompt |", "|---|---|---|---|---|---|---|",
  ...sessions.sort((a, b) => b.tokens.total - a.tokens.total).map((s) => `| \`${s.session_id.slice(0, 8)}\` | ${s.worktree_path.split("/").pop()} | ${s.turns} | ${s.checkpoints} | ${K(s.tokens.output)} | ${M(s.tokens.total)} | ${s.last_prompt.slice(0, 60).replace(/\|/g, "/")} |`), "",
  "Reproduce: `entire session list`, and `entire session tokens <session id>` for a per-session breakdown and Entire's own recommendations (for the long sessions it flags context replay as the main cost).", "",
];
writeFileSync("docs/BUILD-WITH-ENTIRE.md", out.join("\n"));
console.log(out.slice(0, 16).join("\n"));
