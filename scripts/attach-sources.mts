// Usage: npx tsx --env-file=.env.local scripts/attach-sources.mts <trail number>...
// Finds the chat message behind each hand-written requirement of a Trail and stores it (only when the quote is verified).
import { closeDb, db } from "../lib/db";
import { geminiModel } from "../lib/gemini";
import { buildSources } from "../lib/orchestrator";
import { showTrail } from "../lib/entire";
import { attachSources } from "../lib/provenance";

const project = process.env.ENTIRE_PROJECT!;
for (const n of process.argv.slice(2)) {
  const ref = { project, trail: n };
  const trail = await showTrail(ref);
  const sources = await buildSources({ project, repoDir: process.env.TARGET_REPO_DIR!, targetUrl: "", concurrency: 1, model: geminiModel(), log: console.log }, trail, ref);
  const res = await attachSources(trail.id, sources, geminiModel());
  const names = new Map((await db().query("select id, left(text,70) t from requirements where trail_id = $1", [trail.id])).rows.map((r) => [r.id, r.t]));
  for (const r of res) console.log(r.attached ? "sourced " : "no source", names.get(r.id));
}
await closeDb();
