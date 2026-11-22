// Usage: npx tsx --env-file=.env.local scripts/extract-trail.mts <trail-number>...
// Reads each Trail's description and agent sessions, has Gemini extract requirements with citations, and prints them.
// Re-extracts even when the sources are unchanged (clears the stored hash first). No browser runs.
import { closeDb, db } from "../lib/db";
import { showTrail } from "../lib/entire";
import { geminiModel } from "../lib/gemini";
import { syncTrail, type Config } from "../lib/orchestrator";

const need = (k: string) => process.env[k] ?? (() => { throw new Error(`${k} is not set`); })();
const cfg: Config = {
  project: need("ENTIRE_PROJECT"), repoDir: need("TARGET_REPO_DIR"), targetUrl: need("TARGET_URL"), concurrency: 1,
  model: geminiModel(), log: (m) => console.log(new Date().toISOString().slice(11, 19), m),
};
for (const n of process.argv.slice(2)) {
  const ref = { project: cfg.project, trail: n };
  const trail = await showTrail(ref);
  await db().query("update trails set sources_hash = null where id = $1", [trail.id]);
  const t = Date.now();
  await syncTrail(cfg, ref);
  const { rows } = await db().query(
    `select r.text, r.type, r.confidence, r.testable, r.untestable_reason, r.source_kind, r.quote, s.text as supersedes
     from requirements r left join requirements s on s.id = r.supersedes_id where r.trail_id = $1 and r.source_kind <> 'manual' order by r.confidence desc`,
    [trail.id],
  );
  console.log(`\nTrail #${n} "${trail.title}": ${rows.length} extracted in ${Math.round((Date.now() - t) / 1000)}s`);
  for (const r of rows) {
    console.log(`- [${r.source_kind} ${Math.round(r.confidence * 100)}% ${r.testable ? r.type : "UNTESTABLE: " + r.untestable_reason}] ${r.text}`);
    if (r.supersedes) console.log(`    CHANGES: ${r.supersedes}`);
    if (r.quote) console.log(`    quote: "${String(r.quote).slice(0, 100)}"`);
  }
}
await closeDb();
