import { compileRequirement } from "../lib/compile";
import { addFinding, openFindings, resolveFinding } from "../lib/entire";
import { decideFindings, type CheckResult } from "../lib/findings";
import { geminiModel } from "../lib/gemini";
import { runCheck } from "../lib/tinyfish";
import { toVerdict } from "../lib/verdict";

const url = process.env.TARGET_URL!;
const ALL = [
  { id: "seats-total", text: "On the Pro plan with 5 seats on monthly billing, the total shows $95.00 per month." },
  { id: "annual-total", text: "On the Pro plan with 5 seats, after switching to Annual billing the page shows a total of $912.00 per year." },
  { id: "seats-kept", text: "If you set the seat count to 5 and then switch from Monthly to Annual, the seat count is still 5." },
  { id: "coupon-scales", text: "On the Pro plan monthly, apply coupon SAVE10 with 5 seats (discount -$9.50), then raise seats to 6: the discount becomes -$11.40." },
];

const only = process.argv.slice(2);
const REQUIREMENTS = only.length ? ALL.filter((r) => only.includes(r.id)) : ALL;

async function main() {
  const model = geminiModel();
  const results: CheckResult[] = [];
  await Promise.all(
    REQUIREMENTS.map(async (r) => {
     // One check failing to compile or run must never take down the others.
     try {
      const c = await compileRequirement(r, model);
      if (!c.testable) return console.log(`SKIP ${r.id}: ${c.reason}`);
      const t = Date.now();
      const run = await runCheck(c.goal, url, { onStreamingUrl: (u) => console.log(`LIVE ${r.id}: ${u}`) });
      const v = toVerdict(run);
      console.log(`${v.state.toUpperCase().padEnd(7)} ${r.id} (${Math.round((Date.now() - t) / 1000)}s, ${run.steps.length} steps): ${v.reason}`);
      if (v.state !== "errored") {
        results.push({ requirementId: r.id, requirementText: r.text, passed: v.state === "passed", failedStep: v.failedStep, reason: v.reason });
      }
     } catch (e) {
      console.log(`ERRORED ${r.id}: ${String(e).slice(0, 160)}`);
     }
    }),
  );

  for (const a of decideFindings(await openFindings(), results)) {
    if (a.kind === "create") console.log("finding created:", await addFinding(a.requirementId, a.title, a.body));
    else {
      await resolveFinding(a.findingId, a.message);
      console.log("finding resolved:", a.findingId);
    }
  }
}
main();
