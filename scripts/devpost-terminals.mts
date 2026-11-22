// Usage: npx tsx --env-file=.env.local scripts/devpost-terminals.mts [brain-pane-text-file]
// Real output of the Entire commands from the demo, drawn as terminal windows (2x) into docs/devpost/.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
const sh = (cmd: string, cwd: string) => { try { return strip(execSync(cmd, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1" } })).trimEnd(); } catch (e) { return strip(String((e as { stdout?: string }).stdout ?? e)).trimEnd(); } };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const buggy = "/Users/marco/Developer/acme-buggy";
const shots: { file: string; title: string; blocks: { cmd?: string; out: string }[] }[] = [
  { file: "09-terminal-why", title: "acme-buggy: which prompt wrote the line", blocks: [
    { cmd: "entire why lib/pricing.ts:61", out: sh("entire why lib/pricing.ts:61", buggy) },
  ] },
  { file: "10-terminal-gate", title: "acme-buggy: Entire blocks the merge", blocks: [
    { cmd: "entire trail finding list 4 --project gh/marcocharco", out: sh("entire trail finding list 4 --project gh/marcocharco", buggy).split("\n").map((l) => l.slice(0, 118)).join("\n") },
    { cmd: "entire trail merge 4 --project gh/marcocharco --dry-run", out: sh("entire trail merge 4 --project gh/marcocharco --dry-run", buggy) },
  ] },
  { file: "11-terminal-proof", title: "archerfish: read live from Entire, not hardcoded", blocks: [
    { cmd: "npx tsx scripts/entire-proof.mts --summary", out: sh("npx tsx --env-file=.env.local scripts/entire-proof.mts --summary", "/Users/marco/Developer/hw13").split("\n").filter((l) => /^==|^\*\*|^\| (Bug|Control)/.test(l)).map((l) => l.replace(/`/g, "").replace(/\*\*/g, "").slice(0, 150)).join("\n") },
  ] },
];
if (process.argv[2]) shots.push({ file: "12-terminal-brain-block", title: "acme-pricing-demo: Brain holds the edit", blocks: [{ out: readFileSync(process.argv[2], "utf8").trimEnd() }] });

const html = (s: (typeof shots)[number]) => `<body style="margin:0;background:#f4f4f6;padding:36px;font-family:ui-monospace,Menlo,monospace">
<div style="width:1180px;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.25);background:#14141a">
<div style="background:#2a2a33;padding:12px 16px;display:flex;gap:8px;align-items:center"><i style="width:12px;height:12px;border-radius:50%;background:#ff5f57"></i><i style="width:12px;height:12px;border-radius:50%;background:#febc2e"></i><i style="width:12px;height:12px;border-radius:50%;background:#28c840"></i><span style="color:#a7a7b3;font:13px -apple-system,sans-serif;margin-left:12px">${esc(s.title)}</span></div>
<div style="padding:20px 22px;color:#e6e6ee;font-size:14.5px;line-height:1.5">${s.blocks.map((b) => `${b.cmd ? `<div style="color:#8be9a1;margin-top:8px">$ ${esc(b.cmd)}</div>` : ""}<pre style="margin:6px 0 14px;white-space:pre-wrap;word-break:break-word;font:inherit">${esc(b.out)}</pre>`).join("")}</div></div></body>`;

const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await (await browser.newContext({ viewport: { width: 1260, height: 600 }, deviceScaleFactor: 2 })).newPage();
  for (const s of shots) {
    await page.setContent(html(s));
    await page.locator("body > div").screenshot({ path: `docs/devpost/${s.file}.png` });
    console.log("wrote", s.file);
  }
} finally { await browser.close(); }
