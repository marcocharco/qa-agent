// Approved requirements become Entire Brain memories in the target repo. Brain only accepts paths under
// architecture, constraints, preferences, project or workflow, so requirements live under project.requirements.
// The memory id is stored in requirements.brain_path.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "./db";

const exec = promisify(execFile);
const brain = async (args: string[]) =>
  (await exec("entire", ["brain", ...args], { cwd: process.env.TARGET_REPO_DIR, maxBuffer: 16 * 1024 * 1024 })).stdout;

/**
 * The files that implement a requirement, found by asking Entire Graph where the code behind its words lives.
 * Brain anchors a memory to the files its text names, and shows it to an agent about to edit one of them.
 */
export async function locusFor(text: string): Promise<string[]> {
  try {
    const { stdout } = await exec("entire", ["graph", "query", "--format", "json", "--head", "--top-k", "4", text], { cwd: process.env.TARGET_REPO_DIR, maxBuffer: 16 * 1024 * 1024, timeout: 60_000 });
    const files = (JSON.parse(stdout).results as { file_path?: string }[]).map((r) => r.file_path).filter((f): f is string => !!f && /\.(tsx?|jsx?)$/.test(f));
    return [...new Set(files)].slice(0, 2);
  } catch {
    return [];
  }
}

/** Write a requirement to Brain, anchored to the code it constrains, unless it is already there. */
export async function rememberRequirement(id: string): Promise<void> {
  const { rows } = await db().query("select text, brain_path from requirements where id = $1", [id]);
  if (!rows[0] || rows[0].brain_path) return;
  const files = await locusFor(rows[0].text);
  const memory = files.length ? `${files.join(", ")}: ${rows[0].text}` : rows[0].text;
  const out = JSON.parse(await brain(["remember", memory, "--path", "project.requirements.convention", "--kind", "invariant", "--json"]));
  await db().query("update requirements set brain_path = $2 where id = $1", [id, out.id]);
}

/** Retract the requirement's memory, if it has one. */
export async function forgetRequirement(id: string): Promise<void> {
  const { rows } = await db().query("select brain_path from requirements where id = $1", [id]);
  if (!rows[0]?.brain_path) return;
  await brain(["memories", "retract", rows[0].brain_path, "--json"]);
  await db().query("update requirements set brain_path = null where id = $1", [id]);
}
