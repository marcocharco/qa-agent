// Usage: npx tsx --env-file=.env.local scripts/triage.mts <checkId>...
// Finds the likely line and the prompt behind it for failed checks that already have a bug report (backfill).
import { geminiModel } from "../lib/gemini";
import { triageCheck } from "../lib/triage";

for (const id of process.argv.slice(2)) {
  const r = await triageCheck(id, { repoDir: process.env.TARGET_REPO_DIR!, model: geminiModel(), log: console.log });
  console.log(id, r ? `${r.file}:${r.line} ${r.why}` : "no result");
}
process.exit(0);
