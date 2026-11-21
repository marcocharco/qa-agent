// Usage: node check.mjs <url> [--expect correct|buggy]
// Runs the pricing checks against a live ACME page and prints PASS or FAIL per check,
// once against the correct reference values and once against the four planted bug values.
import { chromium } from "playwright-core";

const url = process.argv[2];
const ei = process.argv.indexOf("--expect");
const expect = ei > -1 ? process.argv[ei + 1] : null;
if (!url) {
  console.error("usage: node check.mjs <url> [--expect correct|buggy]");
  process.exit(2);
}

const browser = await chromium.launch({ channel: "chrome" });

const NONE = "none";
// Reads "Total | Volume | Discount" off a plan card, e.g. "$95.00 per month | -$14.50 | none".
async function read(page, plan) {
  const t = (await page.locator(`xpath=//h2[text()="${plan}"]/..`).innerText()).replace(/\n+/g, " | ");
  const m = (re) => (t.match(re) || [null, NONE])[1];
  return {
    total: m(/Total: (\$[\d,.]+ per \w+)/),
    subtotal: m(/Subtotal: (\$[\d,.]+)/),
    volume: m(/Volume discount \(5%\): (-\$[\d,.]+)/),
    coupon: m(/Discount \(SAVE10\): (-\$[\d,.]+)/),
    billed: m(/(Billed \$[\d,.]+ yearly)/),
    perSeat: m(/Price per seat: (\$[\d,.]+)/),
  };
}

async function fresh() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  await page.goto(url);
  await page.getByLabel("Increase Pro seats").waitFor();
  const seatsNow = async (plan) => Number(await page.getByLabel(`${plan} seat count`).innerText());
  const click = async (label, n) => { for (let i = 0; i < n; i++) { const b = page.getByLabel(label); if (!(await b.isEnabled())) return; await b.click(); } };
  return {
    page,
    shown: seatsNow,
    // moves a card to an exact seat count using the visible number
    async seats(plan, target) {
      let cur = await seatsNow(plan);
      if (cur < target) await click(`Increase ${plan} seats`, target - cur);
      if (cur > target) await click(`Decrease ${plan} seats`, cur - target);
    },
    press: (plan, dir, n) => click(`${dir === "up" ? "Increase" : "Decrease"} ${plan} seats`, n),
    async coupon(code = "SAVE10") {
      await page.getByPlaceholder("Coupon code").fill(code);
      await page.getByRole("button", { name: "Apply" }).click();
    },
    annual: () => page.getByRole("button", { name: "Annual" }).click(),
    read: (plan) => read(page, plan),
    close: () => page.close(),
  };
}

// Each check: id, label, run -> string, correct value, buggy value.
const checks = [
  {
    id: "base-1", label: "Pro 5 seats monthly",
    run: async (u) => { await u.seats("Pro", 5); return (await u.read("Pro")).total; },
    correct: "$95.00 per month", buggy: "$95.00 per month",
  },
  {
    id: "base-2", label: "Pro 5 seats monthly + SAVE10 (total | discount)",
    run: async (u) => { await u.seats("Pro", 5); await u.coupon(); const r = await u.read("Pro"); return `${r.total} | ${r.coupon}`; },
    correct: "$85.50 per month | -$9.50", buggy: "$85.50 per month | -$9.50",
  },
  {
    id: "base-3", label: "Team starts at 3 seats, monthly (shown | total)",
    run: async (u) => `${await u.shown("Team")} | ${(await u.read("Team")).total}`,
    correct: "3 | $87.00 per month", buggy: "3 | $87.00 per month",
  },
  {
    id: "base-4", label: "Team 3 seats monthly + SAVE10 (total | discount)",
    run: async (u) => { await u.coupon(); const r = await u.read("Team"); return `${r.total} | ${r.coupon}`; },
    correct: "$78.30 per month | -$8.70", buggy: "$78.30 per month | -$8.70",
  },
  {
    id: "base-5", label: "Team 9 seats monthly has no volume discount (total | volume)",
    run: async (u) => { await u.seats("Team", 9); const r = await u.read("Team"); return `${r.total} | ${r.volume}`; },
    correct: "$261.00 per month | none", buggy: "$261.00 per month | none",
  },
  {
    id: "base-6", label: "Team 11 seats monthly (total | volume)",
    run: async (u) => { await u.seats("Team", 11); const r = await u.read("Team"); return `${r.total} | ${r.volume}`; },
    correct: "$303.05 per month | -$15.95", buggy: "$303.05 per month | -$15.95",
  },
  {
    id: "base-7", label: "Annual per seat prices (Pro | Team)",
    run: async (u) => { await u.annual(); return `${(await u.read("Pro")).perSeat} | ${(await u.read("Team")).perSeat}`; },
    correct: "$15.20 | $23.20", buggy: "$15.20 | $23.20",
  },
  {
    id: "base-8", label: "Pro 5 seats annual (total | billed line)",
    run: async (u) => { await u.annual(); await u.seats("Pro", 5); const r = await u.read("Pro"); return `${r.total} | ${r.billed}`; },
    correct: "$912.00 per year | Billed $912.00 yearly", buggy: "$912.00 per year | Billed $912.00 yearly",
  },
  {
    id: "B", label: "Team 10 seats monthly (subtotal | volume | total)",
    run: async (u) => { await u.seats("Team", 10); const r = await u.read("Team"); return `${r.subtotal} | ${r.volume} | ${r.total}`; },
    correct: "$290.00 | -$14.50 | $275.50 per month", buggy: "$290.00 | none | $290.00 per month",
  },
  {
    id: "C", label: "Team minus pressed twice at 3 seats (shown | total)",
    run: async (u) => { await u.press("Team", "down", 2); return `${await u.shown("Team")} | ${(await u.read("Team")).total}`; },
    correct: "3 | $87.00 per month", buggy: "3 | $29.00 per month",
  },
  {
    id: "D", label: "Pro 5 seats annual + SAVE10 (coupon | total)",
    run: async (u) => { await u.annual(); await u.seats("Pro", 5); await u.coupon(); const r = await u.read("Pro"); return `${r.coupon} | ${r.total}`; },
    correct: "-$91.20 | $820.80 per year", buggy: "-$114.00 | $798.00 per year",
  },
  {
    id: "A", label: "Team 3 seats annual + SAVE10 (subtotal | coupon | total)",
    run: async (u) => { await u.annual(); await u.coupon(); const r = await u.read("Team"); return `${r.subtotal} | ${r.coupon} | ${r.total}`; },
    correct: "$835.20 | -$83.52 | $751.68 per year", buggy: "$835.20 | none | $835.20 per year",
  },
];

let failedExpect = 0;
console.log(`Checking ${url}\n`);
for (const c of checks) {
  const u = await fresh();
  let got;
  try { got = await c.run(u); } catch (e) { got = `ERROR ${String(e.message).split("\n")[0]}`; }
  await u.close();
  const okC = got === c.correct, okB = got === c.buggy;
  console.log(`[${c.id}] ${c.label}\n    got: ${got}`);
  console.log(`    vs correct build: ${okC ? "PASS" : "FAIL"}   vs buggy build: ${okB ? "PASS" : "FAIL"}`);
  if (expect === "correct" && !okC) failedExpect++;
  if (expect === "buggy" && !okB) failedExpect++;
}
await browser.close();

if (expect) {
  console.log(`\n${failedExpect === 0 ? "OK" : "MISMATCH"}: ${failedExpect} check(s) differ from the ${expect} build`);
  process.exit(failedExpect ? 1 : 0);
}
