// Usage: npx tsx scripts/eval/report.mts
// Reads data/eval/runs.jsonl and writes docs/EVAL-RESULTS.md: accuracy (must not be worse), then credits and time (the hoped-for win).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

type Run = { arm: string; build: string; task: string; rep: number; expect: string; verdict: string; observed: string; credits: number; seconds: number; correct: boolean; evidenceOk: boolean | null; detail: Record<string, unknown> };
const runs: Run[] = readFileSync("data/eval/runs.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const blocks = existsSync("data/eval/blocks.jsonl") ? readFileSync("data/eval/blocks.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const arms = ["archerfish", "claude"].filter((a) => runs.some((r) => r.arm === a));
const bugs = new Set(["A", "B", "C", "D"]);

/** 95 percent Wilson interval for k of n. Honest about small samples: three runs say very little. */
const wilson = (k: number, n: number): [number, number] => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n)); return [(c - m) / d, (c + m) / d]; };
const pct = (x: number) => `${Math.round(x * 100)}%`;
const rate = (k: number, n: number) => (n ? `${k}/${n} (${pct(k / n)}, ${pct(wilson(k, n)[0])} to ${pct(wilson(k, n)[1])})` : "n/a");
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : 0; };
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const usd = (x: number) => `$${x.toFixed(3)}`;

const by = (arm: string, f: (r: Run) => boolean = () => true) => runs.filter((r) => r.arm === arm && f(r));
const out: string[] = ["# Eval results: ArcherFish vs a Claude browser agent", "", `Generated ${new Date().toISOString()} from \`data/eval/runs.jsonl\` (${runs.length} runs). Design and definitions: \`docs/EVAL.md\`. Intervals are 95 percent Wilson intervals: with few runs they are wide, and that is the honest reading.`, ""];

out.push("## 1. Accuracy (the claim is: not worse)", "", "| Measure | " + arms.join(" | ") + " |", "|---|" + arms.map(() => "---|").join(""));
const row = (label: string, f: (a: string) => string) => out.push(`| ${label} | ${arms.map(f).join(" | ")} |`);
row("Detection rate, buggy build (bug requirements flagged as failing)", (a) => { const r = by(a, (x) => x.build === "buggy" && bugs.has(x.task)); return rate(r.filter((x) => x.verdict === "fail").length, r.length); });
row("Miss rate (a bug passed)", (a) => { const r = by(a, (x) => x.build === "buggy" && bugs.has(x.task)); return rate(r.filter((x) => x.verdict === "pass").length, r.length); });
row("False alarm rate (failed where nothing is wrong)", (a) => { const r = by(a, (x) => x.expect === "pass"); return rate(r.filter((x) => x.verdict === "fail").length, r.length); });
row("No answer / unconfirmed", (a) => { const r = by(a); return rate(r.filter((x) => x.verdict === "none").length, r.length); });
row("Overall correct", (a) => { const r = by(a); return rate(r.filter((x) => x.correct).length, r.length); });
row("Evidence accuracy (quote contains the real value)", (a) => { const r = by(a, (x) => x.evidenceOk !== null); return rate(r.filter((x) => x.evidenceOk).length, r.length); });
row("Consistency (repeats agree with their majority)", (a) => {
  const g = new Map<string, string[]>();
  for (const r of by(a)) g.set(`${r.build}|${r.task}`, [...(g.get(`${r.build}|${r.task}`) ?? []), r.verdict]);
  let agree = 0, total = 0;
  for (const v of g.values()) { if (v.length < 2) continue; const top = Math.max(...["pass", "fail", "none"].map((x) => v.filter((y) => y === x).length)); agree += top; total += v.length; }
  return total ? rate(agree, total) : "needs 2 or more repeats";
});

out.push("", "## 2. Credits and time (the hoped-for win)", "", "| Measure | " + arms.join(" | ") + " |", "|---|" + arms.map(() => "---|").join(""));
row("Total credits spent", (a) => usd(sum(by(a).map((r) => r.credits))));
row("Median credits per check", (a) => usd(median(by(a).map((r) => r.credits))));
row("Median seconds per check", (a) => `${median(by(a).map((r) => r.seconds)).toFixed(0)}s`);
row("Wall-clock for the whole suite (5 at a time)", (a) => { const b = blocks.filter((x) => x.arm === a); return b.length ? `${b.map((x) => `${Math.round(x.wallSeconds)}s for ${x.runs} runs`).join(", ")}` : "n/a"; });
row("Credits per bug found (total credits / true detections)", (a) => { const det = by(a, (x) => x.build === "buggy" && bugs.has(x.task) && x.verdict === "fail").length; return det ? usd(sum(by(a).map((r) => r.credits)) / det) : "no detections"; });

if (arms.length === 2) {
  // Paired: the same check, build and repeat, one system against the other.
  const key = (r: Run) => `${r.build}|${r.task}|${r.rep}`;
  const a = new Map(by("archerfish").map((r) => [key(r), r])), c = new Map(by("claude").map((r) => [key(r), r]));
  const pairs = [...a.keys()].filter((k) => c.has(k)).map((k) => ({ a: a.get(k)!, c: c.get(k)! }));
  out.push("", "## 3. Paired comparison (same check, same build, same repeat)", "", `${pairs.length} pairs.`, "",
    `- ArcherFish was cheaper in ${pairs.filter((p) => p.a.credits < p.c.credits).length} of ${pairs.length} pairs; median saving ${usd(median(pairs.map((p) => p.c.credits - p.a.credits)))} per check.`,
    `- ArcherFish was faster in ${pairs.filter((p) => p.a.seconds < p.c.seconds).length} of ${pairs.length} pairs; median saving ${median(pairs.map((p) => p.c.seconds - p.a.seconds)).toFixed(0)}s per check.`,
    `- Both correct in ${pairs.filter((p) => p.a.correct && p.c.correct).length}; only ArcherFish correct in ${pairs.filter((p) => p.a.correct && !p.c.correct).length}; only Claude correct in ${pairs.filter((p) => !p.a.correct && p.c.correct).length}; neither in ${pairs.filter((p) => !p.a.correct && !p.c.correct).length}.`);
}

out.push("", "## 4. Per requirement", "", "| Requirement | Build | Should | " + arms.map((a) => `${a} verdicts`).join(" | ") + " |", "|---|---|---|" + arms.map(() => "---|").join(""));
const keys = [...new Set(runs.map((r) => `${r.task}|${r.build}`))].sort();
for (const k of keys) {
  const [t, b] = k.split("|");
  const exp = runs.find((r) => r.task === t && r.build === b)!.expect;
  out.push(`| ${t} | ${b} | ${exp} | ${arms.map((a) => by(a, (x) => x.task === t && x.build === b).map((x) => x.verdict[0]).join(" ") || "-").join(" | ")} |`);
}
out.push("", "p = pass, f = fail, n = no answer or unconfirmed. One letter per repeat.", "");
writeFileSync("docs/EVAL-RESULTS.md", out.join("\n"));
console.log(out.join("\n"));
