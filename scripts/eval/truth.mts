// Usage: npx tsx --env-file=.env.local scripts/eval/truth.mts
// The oracle check: a plain Playwright script (no AI) is run against both builds. If it does not agree with the
// ground-truth table, scoring against that table would be meaningless, so the eval must not start.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const gt = JSON.parse(readFileSync("eval/ground-truth.json", "utf8"));
let ok = true;
for (const [build, url] of Object.entries(gt.builds) as [string, string][]) {
  const expect = build === "buggy" ? "buggy" : "correct";
  try {
    execFileSync("node", ["demo/verify/check.mjs", url, "--expect", expect], { stdio: "pipe", timeout: 180_000 });
    console.log(`oracle agrees: ${build} (${url}) behaves as the ${expect} build`);
  } catch (e) {
    ok = false;
    console.log(`ORACLE DISAGREES for ${build} (${url}):\n${String((e as { stdout?: Buffer }).stdout ?? e).slice(0, 600)}`);
  }
}
process.exit(ok ? 0 : 1);
