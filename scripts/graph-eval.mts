// Usage: npx tsx --env-file=.env.local scripts/graph-eval.mts <checkId>...
// Triage with the whole changed files vs with Entire Graph's ranked regions: context size and the line each picks.
import { geminiModel } from "../lib/gemini";
import { triageCheck } from "../lib/triage";

const model = geminiModel();
const repoDir = process.env.TARGET_REPO_DIR!;
let files = 0, graph = 0;
for (const id of process.argv.slice(2)) {
  const a = await triageCheck(id, { repoDir, model }, { context: "files", dryRun: true });
  const b = await triageCheck(id, { repoDir, model }, { context: "graph", dryRun: true });
  console.log(id.slice(0, 8), "files:", a ? `${a.file}:${a.line} ctx~${Math.round(a.contextChars / 4)}tok` : "none", "| graph:", b ? `${b.file}:${b.line} ctx~${Math.round(b.contextChars / 4)}tok` : "none");
  if (a && b) { files += a.contextChars / 4; graph += b.contextChars / 4; }
}
console.log(`total context tokens (~chars/4): files ${Math.round(files)}, graph ${Math.round(graph)}, saved ${files ? Math.round((1 - graph / files) * 100) : 0}%`);
process.exit(0);
