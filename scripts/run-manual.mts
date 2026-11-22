// Usage: npx tsx --env-file=.env.local scripts/run-manual.mts <trail-number>
// Runs the real orchestrator (TinyFish, Postgres, findings) with hand-written requirements and goals,
// so the browser side can be tested without Gemini. Extraction returns nothing, compiling is scripted.
import { closeDb, db } from "../lib/db";
import { COMPILER_PROMPT, renderGoal, type CheckSpec, type StructuredModel } from "../lib/compile";
import { processTrail, syncTrail, type Config } from "../lib/orchestrator";

type Manual = { trail: string; feature: string; text: string; type: "behaviour" | "validation"; spec: CheckSpec };
const R = (trail: string, feature: string, text: string, steps: string[], expected: string): Manual =>
  ({ trail, feature, text, type: "behaviour", spec: { preconditions: ["The pricing page is open on Monthly billing with no coupon applied"], steps, expected } });

// Trail 3 is the merged base pricing Trail (regression), Trail 4 the demo Trail.
const REQS: Manual[] = [
  R("3", "Seats", "Team needs at least 3 seats: pressing minus at 3 seats keeps the count at 3 and the total at $87.00 per month.",
    ["Look at the Team plan card at its default seat count", "Decrease the Team seat count twice"],
    "The Team seat count shows 3 and the Team total shows $87.00 per month"),
  R("3", "Seats", "Pro at 5 seats monthly totals $95.00 per month.",
    ["Set the Pro seat count to 5"], "The Pro total shows $95.00 per month"),
  R("3", "Coupon", "SAVE10 takes 10% off the Team plan on monthly billing.",
    ["Leave the Team seat count at 3", "Apply the coupon code SAVE10"],
    "The Team card shows Discount (SAVE10) -$8.70 and a total of $78.30 per month"),
  R("4", "Annual billing", "Pro at 5 seats on annual billing totals $912.00 per year, with the line Billed $912.00 yearly.",
    ["Switch billing to Annual", "Set the Pro seat count to 5"],
    "The Pro total shows $912.00 per year and a line reads Billed $912.00 yearly"),
  R("4", "Volume discount", "Team gets 5% off the subtotal at 10 or more seats: Team at 10 seats monthly has subtotal $290.00, volume discount -$14.50, total $275.50 per month.",
    ["Set the Team seat count to 10"],
    "The Team card shows Subtotal $290.00, a Volume discount (5%) line of -$14.50, and a total of $275.50 per month"),
  R("4", "Volume discount", "Team at 9 seats monthly gets no volume discount and totals $261.00 per month.",
    ["Set the Team seat count to 9"], "The Team card shows no volume discount line and a total of $261.00 per month"),
  R("4", "Annual billing", "SAVE10 works on Team in annual mode: Team at 3 seats annual with SAVE10 has subtotal $835.20, discount -$83.52, total $751.68 per year.",
    ["Switch billing to Annual", "Leave the Team seat count at 3", "Apply the coupon code SAVE10"],
    "The Team card shows Subtotal $835.20, Discount (SAVE10) -$83.52, and a total of $751.68 per year"),
  R("4", "Annual billing", "Annual comes first, then the coupon: Pro at 5 seats annual with SAVE10 has discount -$91.20 and total $820.80 per year.",
    ["Switch billing to Annual", "Set the Pro seat count to 5", "Apply the coupon code SAVE10"],
    "The Pro card shows Discount (SAVE10) -$91.20 and a total of $820.80 per year"),
];

const model: StructuredModel = async (prompt) => {
  if (!prompt.startsWith(COMPILER_PROMPT)) return { requirements: [] };
  const text = prompt.slice(COMPILER_PROMPT.length);
  const m = REQS.find((r) => r.text === text);
  if (!m) return { testable: false, reason: "No scripted spec for this requirement" };
  return { testable: true, ...m.spec };
};

const need = (k: string) => process.env[k] ?? (() => { throw new Error(`${k} is not set`); })();
const trail = process.argv[2] ?? "4";
const cfg: Config = {
  project: need("ENTIRE_PROJECT"),
  repoDir: need("TARGET_REPO_DIR"),
  targetUrl: need("TARGET_URL"),
  concurrency: Number(process.env.CONCURRENCY ?? 2),
  model,
  log: (m) => console.log(new Date().toISOString().slice(11, 19), m),
};

// Creates the trail rows (extraction is scripted to find nothing), then adds the hand-written requirements.
const ids = new Map<string, string>();
for (const t of new Set(REQS.map((r) => r.trail))) ids.set(t, (await syncTrail(cfg, { project: cfg.project, trail: t })).id);
for (const r of REQS) {
  const trailId = ids.get(r.trail)!;
  await db().query(
    `insert into requirements (id,trail_id,text,type,confidence,testable,status,source_kind,feature)
     select gen_random_uuid()::text,$1,$2,$3,1,true,'approved','manual',$4
     where not exists (select 1 from requirements where trail_id=$1 and text=$2)`,
    [trailId, r.text, r.type, r.feature],
  );
  await db().query("update requirements set feature=$3 where trail_id=$1 and text=$2", [trailId, r.text, r.feature]);
}
console.log(await processTrail(cfg, { project: cfg.project, trail }));
await closeDb();
