// Approved requirements become Entire Brain memories in the target repo. Brain only accepts paths under
// architecture, constraints, preferences, project or workflow, so requirements live under project.requirements.
// The memory id is stored in requirements.brain_path.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "./db";

const exec = promisify(execFile);
const brain = async (args: string[]) =>
  (await exec("entire", ["brain", ...args], { cwd: process.env.TARGET_REPO_DIR, maxBuffer: 16 * 1024 * 1024 })).stdout;

/** Write a requirement to Brain unless it is already there. */
export async function rememberRequirement(id: string): Promise<void> {
  const { rows } = await db().query("select text, brain_path from requirements where id = $1", [id]);
  if (!rows[0] || rows[0].brain_path) return;
  const out = JSON.parse(await brain(["remember", rows[0].text, "--path", "project.requirements.convention", "--kind", "convention", "--json"]));
  await db().query("update requirements set brain_path = $2 where id = $1", [id, out.id]);
}

/** Retract the requirement's memory, if it has one. */
export async function forgetRequirement(id: string): Promise<void> {
  const { rows } = await db().query("select brain_path from requirements where id = $1", [id]);
  if (!rows[0]?.brain_path) return;
  await brain(["memories", "retract", rows[0].brain_path, "--json"]);
  await db().query("update requirements set brain_path = null where id = $1", [id]);
}
