// Usage: npx tsx --env-file=.env.local scripts/graph-eval.mts [repeats]
// Tests the claim "Entire Graph gives the triage model less code to read". For each planted bug, the same question goes to
// Gemini with three kinds of code context, and we measure what Gemini bills (real prompt tokens, not an estimate), whether
// it points at the right line, and whether `entire why` on that line finds the right prompt. Writes docs/GRAPH-EVAL.md.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { attributeLine } from "../lib/attribution";
import { Answer, changedSources, graphContext, numbered, triagePrompt, validatePick } from "../lib/triage";

const run = promisify(execFile);
const repo = process.env.TARGET_REPO_DIR!;
const R = Number(process.argv[2] ?? 2);
const model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const git = async (args: string[], cwd = repo) => (await run("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout;

type Bug = { id: string; requirement: string; reason: string; file: string; needle: string; after?: string; tol: number; prompt: number };
const bugs: Bug[] = [
  { id: "A", requirement: "SAVE10 works on Team in annual mode: Team at 3 seats annual with SAVE10 has subtotal $835.20, discount -$83.52, total $751.68 per year.", reason: "The page shows a total of $835.20 per year and no coupon discount line. Expected discount -$83.52 and total $751.68.", file: "lib/pricing.ts", needle: "couponDiscountCents: 0,", after: "export function annualQuote", tol: 10, prompt: 5 },
  { id: "B", requirement: "Team gets 5% off the subtotal at 10 or more seats: Team at 10 seats monthly has subtotal $290.00, volume discount -$14.50, total $275.50 per month.", reason: "Team at 10 seats shows a total of $290.00 per month with no volume discount line.", file: "lib/pricing.ts", needle: "seats > volume.over", tol: 2, prompt: 8 },
  { id: "C", requirement: "Team needs at least 3 seats: pressing minus at 3 seats keeps the count at 3 and the total at $87.00 per month.", reason: "After pressing minus at 3 seats the seat count still shows 3 but the total is $58.00 per month, not $87.00.", file: "components/PricingCard.tsx", needle: "Math.max(1, s - 1)", tol: 2, prompt: 7 },
  { id: "D", requirement: "Annual comes first, then the coupon: Pro at 5 seats annual with SAVE10 has discount -$91.20 and total $820.80 per year.", reason: "Pro at 5 seats annual with SAVE10 shows discount -$114.00 and total $798.00 per year, not -$91.20 and $820.80.", file: "lib/pricing.ts", needle: "couponFor(coupon, monthlyCents * seats * MONTHS_PER_YEAR)", tol: 3, prompt: 9 },
];

const parts = (await readFile("demo/sessions/02-annual-volume.md", "utf8")).split(/^\[(\d+)\]\s*$/m);
const prompts = new Map<number, string>();
for (let i = 1; i < parts.length; i += 2) prompts.set(Number(parts[i]), parts[i + 1].trim());

const dir = await mkdtemp(path.join(os.tmpdir(), "gexp-"));
type Arm = "files" | "diff" | "graph";
type Row = { bug: string; arm: Arm; tokens: number; located: boolean; attributed: boolean };
const rows: Row[] = [];
try {
  await git(["fetch", "origin", "feat/annual-volume"]);
  await git(["worktree", "add", "--detach", dir, "origin/feat/annual-volume"]);
  const files = await changedSources(dir, "origin/main");
  const filesCtx = [...files].map(([f, t]) => `=== ${f}\n${numbered(t)}`).join("\n\n");
  const diffCtx = await git(["diff", "-U10", "origin/main...HEAD", "--", "*.ts", "*.tsx"], dir);

  const expectedLine = async (b: Bug) => {
    const lines = (await readFile(path.join(dir, b.file), "utf8")).split("\n");
    const start = b.after ? lines.findIndex((l) => l.includes(b.after!)) : 0;
    return lines.findIndex((l, i) => i >= start && l.includes(b.needle)) + 1;
  };

  const ask = async (bug: Bug, arm: Arm, ctx: string, ranked: boolean): Promise<Row> => {
    const res = await ai.models.generateContent({
      model,
      contents: triagePrompt(bug.requirement, bug.reason, ctx, ranked),
      config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(Answer), temperature: 0, httpOptions: { timeout: 240_000 } },
    });
    const tokens = res.usageMetadata?.promptTokenCount ?? 0;
    const pick = validatePick(Answer.parse(JSON.parse(res.text ?? "null")), files);
    const want = await expectedLine(bug);
    const located = !!pick && pick.file === bug.file && Math.abs(pick.line - want) <= bug.tol;
    let attributed = false;
    if (pick) {
      const a = await attributeLine(pick.file, pick.line, dir).catch(() => null);
      attributed = !!a?.prompt && a.prompt.text.trim().startsWith((prompts.get(bug.prompt) ?? "?").slice(0, 60));
    }
    return { bug: bug.id, arm, tokens, located, attributed };
  };

  const jobs: (() => Promise<void>)[] = [];
  for (const bug of bugs) {
    const graph = (await graphContext(dir, `${bug.requirement}. ${bug.reason}`)) ?? filesCtx;
    for (let r = 0; r < R; r++) {
      jobs.push(async () => { rows.push(await ask(bug, "files", filesCtx, false)); });
      jobs.push(async () => { rows.push(await ask(bug, "diff", diffCtx, false)); });
      jobs.push(async () => { rows.push(await ask(bug, "graph", graph, true)); });
    }
  }
  // A few calls at a time: Gemini answers take tens of seconds each.
  const queue = [...jobs];
  await Promise.all(Array.from({ length: 4 }, async () => { for (let j = queue.shift(); j; j = queue.shift()) await j().catch((e) => console.log("call failed", String(e).slice(0, 100))); }));
} finally {
  await git(["worktree", "remove", "--force", dir]).catch(() => {});
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const arm = (a: Arm) => rows.filter((r) => r.arm === a);
const base = mean(arm("files").map((r) => r.tokens));
const out: string[] = [
  "# Graph eval: does Entire Graph give the triage model less to read?", "",
  `Generated ${new Date().toISOString()} by \`scripts/graph-eval.mts\`. Model \`${model}\`, ${bugs.length} planted bugs x ${R} repeats x 3 kinds of code context. Token counts are what Gemini reports for the prompt (\`usageMetadata.promptTokenCount\`), not an estimate.`, "",
  "- **files**: every source file the branch changed, whole, with line numbers (what ArcherFish sent before Graph).",
  "- **diff**: the branch's unified diff with 10 lines of context (a fair, cheap baseline).",
  "- **graph**: the regions `entire graph query` ranks for the failure.", "",
  "| Code context | Mean prompt tokens | vs files | Points at the right line | Finds the right prompt (`entire why`) |", "|---|---|---|---|---|",
  ...(["files", "diff", "graph"] as Arm[]).map((a) => `| ${a} | ${Math.round(mean(arm(a).map((r) => r.tokens)))} | ${a === "files" ? "baseline" : `${Math.round((1 - mean(arm(a).map((r) => r.tokens)) / base) * 100)}% fewer`} | ${arm(a).filter((r) => r.located).length}/${arm(a).length} | ${arm(a).filter((r) => r.attributed).length}/${arm(a).length} |`),
  "", "## Per bug (mean prompt tokens)", "", "| Bug | files | diff | graph | graph vs files |", "|---|---|---|---|---|",
  ...bugs.map((b) => { const m = (a: Arm) => mean(rows.filter((r) => r.bug === b.id && r.arm === a).map((r) => r.tokens)); return `| ${b.id} | ${Math.round(m("files"))} | ${Math.round(m("diff"))} | ${Math.round(m("graph"))} | ${Math.round((1 - m("graph") / m("files")) * 100)}% fewer |`; }),
  "", "## Caveats", "",
  "- The demo repo is small (three changed source files), so the absolute numbers are small. In a larger repo the files baseline grows with the change while a ranked query stays bounded, so the saving would be larger, but this eval does not show that.",
  "- The failure descriptions come from the answer key (`demo/ANSWER_KEY.md`), which records what the buggy site really shows.",
  "- Four bugs and a few repeats is a small sample. Read the percentages as a measurement on this repo, not a general constant.", "",
];
await writeFile("docs/GRAPH-EVAL.md", out.join("\n"));
console.log(out.join("\n"));
