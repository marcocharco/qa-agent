// Usage: npx tsx --env-file=.env.local scripts/seed-ui.mts [--remove]
// Inserts clearly marked sample rows (ids start with "sample-") so every dashboard screen can be built
// and screenshotted before the orchestrator has run. --remove deletes them again.
import { closeDb, db } from "../lib/db";

const q = (sql: string, p: unknown[] = []) => db().query(sql, p);

async function remove() {
  // Also catches rows added through the dashboard to a sample Trail.
  const t = "trail_id like 'sample-%'";
  await q(`delete from bug_reports where check_id in (select id from checks where run_id in (select id from runs where ${t}))`);
  await q(`delete from steps where check_id in (select id from checks where run_id in (select id from runs where ${t}))`);
  await q(`delete from checks where run_id in (select id from runs where ${t})`);
  await q(`delete from runs where ${t}`);
  await q(`delete from requirements where ${t}`);
  await q("delete from trails where id like 'sample-%'");
}

// id, trail, text, type, confidence, testable, untestable reason, status, source kind, session, message, quote, edited
type Req = [string, string, string, string, number, boolean, string | null, string, string, string | null, string | null, string | null, boolean?];

const BASE = "sample-trail-base";
const DEMO = "sample-trail-demo";
const S1 = "sample-session-01";
const S2 = "sample-session-02";

const reqs: Req[] = [
  // Regression, from the merged base Trail
  ["sample-r-b1", BASE, "Pro costs $19.00 per seat per month and allows 1 to 50 seats.", "behaviour", 0.95, true, null, "approved", "description", null, "description", "Pro is $19.00 per seat per month, 1 to 50 seats."],
  ["sample-r-b2", BASE, "Team costs $29.00 per seat per month and needs at least 3 seats. Pressing minus at 3 seats does nothing.", "validation", 0.93, true, null, "approved", "session", S1, "msg-01-03", "3 seats minimum ... the minus button has to stop at 3 ... pressing minus there should do nothing"],
  ["sample-r-b3", BASE, "The coupon SAVE10 takes 10% off the total on both plans, in any case and ignoring spaces.", "behaviour", 0.9, true, null, "approved", "session", S1, "msg-01-05", "it applies to both cards"],
  ["sample-r-b4", BASE, "Team with 3 seats monthly shows $87.00, and $78.30 with SAVE10.", "behaviour", 0.97, true, null, "approved", "description", null, "description", "Team 3 seats monthly is $87.00, with SAVE10 $78.30."],
  ["sample-r-b5", BASE, "Unknown coupon codes show an error and change no price.", "validation", 0.6, true, null, "proposed", "session", S1, "msg-01-06", "and if someone types a random code it should just say it's not valid"],
  // New, from the demo Trail
  ["sample-r-d1", DEMO, "Team on 10 seats monthly shows a subtotal of $290.00, a 5% volume discount of -$14.50 and a total of $275.50. 9 seats gets no discount.", "behaviour", 0.96, true, null, "approved", "session", S2, "msg-02-02", "team gets 5% off the subtotal at 10 or more seats ... check: team on 10 seats monthly is subtotal $290.00, volume discount -$14.50, total $275.50. 9 seats gets no discount."],
  ["sample-r-d2", DEMO, "Annual billing is 20% off the per seat price, so Pro is $15.20 and Team is $23.20 per seat.", "behaviour", 0.94, true, null, "approved", "session", S2, "msg-02-01", "annual is 20% off the per seat price, so pro is $15.20 a seat and team is $23.20 a seat"],
  ["sample-r-d3", DEMO, "Pro with 5 seats on annual billing and SAVE10 shows a discount of -$91.20 and a total of $820.80.", "behaviour", 0.92, true, null, "approved", "session", S2, "msg-02-03", "pro 5 seats annual with SAVE10 is discount -$91.20, total $820.80"],
  ["sample-r-d4", DEMO, "SAVE10 still works on Team in annual mode: 3 seats gives a subtotal of $835.20, a discount of -$83.52 and a total of $751.68.", "behaviour", 0.91, true, null, "approved", "session", S2, "msg-02-03", "SAVE10 has to work on both plans in both billing modes ... subtotal $835.20, discount -$83.52, total $751.68", true],
  ["sample-r-d5", DEMO, "The pricing page should feel more trustworthy.", "visual", 0.4, false, "Subjective. The ask names no observable behaviour or value to check.", "proposed", "session", S2, "msg-02-04", "the pricing page should feel more trustworthy. no idea what exactly, just more legit"],
  ["sample-r-d6", DEMO, "The billing toggle shows Monthly and Annual and defaults to Monthly.", "visual", 0.7, true, null, "proposed", "description", null, "description", "Add a Monthly/Annual toggle"],
  ["sample-r-d7", DEMO, "Totals switch to per year in annual mode and a line under the total shows the monthly equivalent.", "behaviour", 0.55, true, null, "rejected", "session", S2, "msg-02-01", "totals switch to \"per year\" and there's a line under the total"],
  ["sample-r-d8", DEMO, "The volume discount starts at 11 seats.", "behaviour", 0.5, true, null, "superseded", "session", S2, "msg-02-07", "the discount applies once they're over 10 seats"],
  ["sample-r-d9", DEMO, "Checkout must work with Apple Pay.", "access", 1, true, null, "approved", "manual", null, null, null, true],
];

async function seed() {
  await remove();
  await q("insert into trails (id,title,description,branch,state,last_head_sha) values ($1,$2,$3,$4,'merged','a1b2c3d')", [BASE, "Base pricing: per-card seats, Team minimum, SAVE10 coupon", "Make the static ACME pricing page live. Each card has its own seat stepper and total. Pro is $19.00 per seat per month, 1 to 50 seats. Team is $29.00 per seat per month, 3 seats minimum.", "base-pricing"]);
  await q("insert into trails (id,title,description,branch,state,last_head_sha) values ($1,$2,$3,$4,'open','e4f5a6b')", [DEMO, "Annual billing and volume pricing", "Add a Monthly/Annual toggle (20% off annual) and a 5% Team volume discount at 10 or more seats. SAVE10 must keep working everywhere.", "annual-volume"]);
  for (const r of reqs) {
    await q(
      `insert into requirements (id,trail_id,text,type,confidence,testable,untestable_reason,status,source_kind,source_session_id,source_message_id,quote,edited_by_human)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12] ?? false],
    );
  }
  const old = Date.now() - 3 * 3600_000;
  await q("insert into runs (id,trail_id,head_sha,started_at,finished_at,passed_count,failed_count,errored_count) values ('sample-run-old',$1,'9f8e7d6',$2,$3,4,1,0)", [DEMO, new Date(old - 140_000), new Date(old)]);
  await q("insert into runs (id,trail_id,head_sha,started_at,finished_at,passed_count,failed_count,errored_count) values ('sample-run-older',$1,'3c2b1a0',$2,$3,2,3,1)", [DEMO, new Date(old - 86_400_000 - 200_000), new Date(old - 86_400_000)]);
  await q("insert into runs (id,trail_id,head_sha,started_at) values ('sample-run-1',$1,'e4f5a6b',now() - interval '95 seconds')", [DEMO]);

  const check = (id: string, run: string, req: string, passed: boolean | null, step: number | null, reason: string | null, url: string | null, ms: number | null) =>
    q("insert into checks (id,run_id,requirement_id,goal,passed,failed_step,reason,streaming_url,duration_ms,tinyfish_run_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$1)", [id, run, req, `Open the pricing page and verify the requirement. Stop on any deviation.`, passed, step, reason, url, ms]);
  const live = "about:blank#sample-live-browser";
  await check("sample-c-old", "sample-run-old", "sample-r-d4", false, 6, "The discount line stayed at $0.00 and the total was $835.20 instead of $751.68.", null, 41_000);
  await check("sample-c1", "sample-run-1", "sample-r-d1", false, 7, "Expected a volume discount of -$14.50 and a total of $275.50, but no volume discount line was shown and the total was $290.00.", null, 38_000);
  await check("sample-c2", "sample-run-1", "sample-r-d2", true, null, "Pro showed $15.20 and Team showed $23.20 per seat in annual mode.", null, 29_000);
  await check("sample-c3", "sample-run-1", "sample-r-d3", false, 8, "Expected a total of $820.80 with a discount of -$91.20, but the page showed -$114.00 and $798.00.", null, 44_000);
  await check("sample-c4", "sample-run-1", "sample-r-d4", false, 6, "Expected -$83.52 and $751.68, but the coupon line was missing and the total stayed at $835.20.", null, 40_000);
  await check("sample-c5", "sample-run-1", "sample-r-d6", null, null, "Run FAILED: browser session timed out", null, 61_000);
  await check("sample-c6", "sample-run-1", "sample-r-b2", true, null, "Minus stopped at 3 seats and the total stayed $87.00.", null, 33_000);
  await check("sample-c7", "sample-run-1", "sample-r-b3", null, null, null, live, null);
  await check("sample-c8", "sample-run-1", "sample-r-b4", null, null, null, live, null);
  await check("sample-c9", "sample-run-1", "sample-r-b1", null, null, null, null, null);
  const steps = ["Open the pricing page", "Switch the billing toggle to Annual", "Select the Team card", "Set seats to 3", "Type SAVE10 into the coupon box and apply it", "Read the discount and total lines"];
  for (const c of ["sample-c4", "sample-c3", "sample-c1"]) for (const [i, s] of steps.entries()) await q("insert into steps (check_id,index,purpose) values ($1,$2,$3)", [c, i + 1, s]);
  await q("insert into bug_reports (id,check_id,finding_id,summary_md) values ('sample-bug-4','sample-c4','sample-finding-4','**SAVE10 still works on Team in annual mode**\n\nFailed at step 6.')");
}

const removing = process.argv.includes("--remove");
await (removing ? remove() : seed());
console.log(removing ? "sample rows removed" : "sample rows inserted");
await closeDb();
