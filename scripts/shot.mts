// Usage: npx tsx scripts/shot.mts <path> <out.png> [width] [--full]
// Screenshots a dashboard page with the system Chrome, for visual checks.
import { chromium } from "playwright-core";

const [path, out, width = "1280"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
await page.goto(`http://localhost:3100${path}`, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
