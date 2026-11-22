// Usage: npx tsx scripts/devpost-shots.mts
// Takes the dashboard screenshots for the Devpost page with the system Chrome, at 2x, into docs/devpost/.
import { chromium } from "playwright-core";

const BASE = "http://localhost:3100";
const TRAIL = "01M806M5X8JX9YTCJ7XQ3ZKFC7";
const BUG = "62dfa030-0390-49bf-b935-f4c447b6ec57"; // 5% off at 10 seats
const out = (n: string) => `docs/devpost/${n}.png`;

const browser = await chromium.launch({ channel: "chrome" });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const go = async (path: string, wait = "h1") => { await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }); await page.waitForSelector(wait, { timeout: 20000 }); await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button] { display: none !important; }" }); await page.waitForTimeout(1500); };

  // 1. Trails home
  await go("/");
  await page.screenshot({ path: out("01-trails") });

  // 2. Run view, results, a failing check selected with its replay
  await go(`/t/${TRAIL}`, "nav[aria-label='Requirements by feature']");
  await page.getByRole("button", { name: /Team gets 5%/ }).first().click();
  await page.waitForSelector('section[aria-label="Replay"] img', { timeout: 15000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: out("02-run-results") });

  // 3. Requirements, mined from the chat, with the drift cards
  await go(`/t/${TRAIL}/requirements`, "text=Changes to earlier requirements");
  await page.screenshot({ path: out("03-requirements"), fullPage: true });

  // 4. Where a requirement came from (the chat message, in context)
  await page.locator("li", { hasText: "Team gets 5% off the subtotal at 10 or more seats" }).getByText("Session source").first().click();
  await page.waitForSelector("dialog[open]", { timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out("04-session-source") });
  await page.keyboard.press("Escape");

  // 5. Bug report: replay, boxed value, expected vs actual, steps
  await go(`/t/${TRAIL}/checks/${BUG}`, 'section[aria-label="Replay"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out("05-bug-report"), fullPage: true });

  // 6. The same bug: the line of code, the commit, and the prompt that wrote it
  await page.getByRole("tab", { name: "5. Prompt" }).click();
  await page.waitForTimeout(800);
  const top = await page.locator("h3", { hasText: "Likely code" }).locator("xpath=..").boundingBox();
  const end = await page.locator("h3", { hasText: "Prompt that introduced it" }).locator("xpath=..").boundingBox();
  if (top && end) await page.screenshot({ path: out("06-code-and-prompt"), fullPage: true, clip: { x: 0, y: top.y - 16, width: 1600, height: end.y + end.height - top.y + 32 } });

  // 7. The report page that can stand in for a PR description: the top, and the proof section
  await go(`/r/${TRAIL}`, "main");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out("07-report-top") });
  await page.evaluate(() => { const h = [...document.querySelectorAll("h2, h3, p")].find((e) => e.textContent?.trim() === "Proof it works"); if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 24); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out("08-report-proof") });
} finally { await browser.close(); }
console.log("done");
