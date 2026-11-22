// Usage: npx tsx --env-file=.env.local scripts/backfill-replay.mts <tinyfish-run-id>
// Downloads the replay of an older run and attaches it to the checks that used that run.
import { closeDb, db } from "../lib/db";
import { saveReplay } from "../lib/replay";

const runId = process.argv[2];
if (!runId) throw new Error("usage: backfill-replay.mts <tinyfish-run-id>");
const rp = await saveReplay(runId);
const { rows } = await db().query("select id, session_pos from checks where tinyfish_run_id = $1", [runId]);
for (const c of rows) {
  await db().query("delete from steps where check_id = $1", [c.id]);
  for (const [k, st] of rp.steps.entries()) {
    await db().query("insert into steps (check_id,index,action,screenshot_path,duration_s,at) values ($1,$2,$3,$4,$5,$6)", [c.id, k + 1, st.action, st.file, st.durationS, st.at]);
  }
  await db().query("update checks set video_path = $2, session_pos = coalesce(session_pos, $3) where id = $1", [c.id, rp.video, rows.indexOf(c) + 1]);
}
console.log(`${rp.steps.length} steps, ${rows.length} checks updated`);
await closeDb();
