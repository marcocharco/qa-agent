import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { compileRequirement, type StructuredModel } from "./compile";
import { db } from "./db";
import {
  addFinding, closedTrailNumbers, openFindings, resolveFinding, sessionTranscript, showTrail,
  trailSessionIds, type TrailInfo, type TrailRef,
} from "./entire";
import { extractRequirements, type Source } from "./extract";
import { decideFindings, type CheckResult } from "./findings";
import { runCheck } from "./tinyfish";
import { parseTranscript } from "./transcript";
import { toVerdict } from "./verdict";

const execGit = promisify(execFile);

export type Config = {
  project: string; // gh/<owner>
  repoDir: string; // local clone where the Trail's sessions were recorded
  targetUrl: string;
  concurrency: number;
  model: StructuredModel;
  log?: (msg: string) => void;
};

/** Run at most `limit` tasks at once. A throwing task never stops the others. */
async function pool<T>(limit: number, items: T[], task: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item);
    }),
  );
}

async function buildSources(cfg: Config, trail: TrailInfo, ref: TrailRef): Promise<Source[]> {
  const sources: Source[] = [
    { kind: "description", id: `trail-${trail.number}`, messages: [{ id: "description", role: "user", text: `${trail.title}\n\n${trail.body}` }] },
  ];
  for (const sid of await trailSessionIds(ref)) {
    try {
      const messages = parseTranscript(await sessionTranscript(sid, cfg.repoDir));
      if (messages.length) sources.push({ kind: "session", id: sid, messages });
    } catch (e) {
      cfg.log?.(`session ${sid} unreadable, skipped: ${String(e).slice(0, 120)}`);
    }
  }
  return sources;
}

/**
 * Sync one Trail into Postgres and mine its requirements. Extraction is skipped when the sources
 * are unchanged. Existing rows (approved, edited, rejected) are never overwritten, only new text is added.
 */
export async function syncTrail(cfg: Config, ref: TrailRef): Promise<TrailInfo> {
  const trail = await showTrail(ref);
  const sources = await buildSources(cfg, trail, ref);
  const hash = createHash("sha256").update(JSON.stringify(sources)).digest("hex");
  const state = trail.merged ? "merged" : "open";
  const prev = await db().query("select sources_hash from trails where id=$1", [trail.id]);
  await db().query(
    `insert into trails (id,title,description,branch,state,sources_hash) values ($1,$2,$3,$4,$5,null)
     on conflict (id) do update set title=$2, description=$3, branch=$4, state=$5`,
    [trail.id, trail.title, trail.body, trail.branch ?? "", state],
  );
  if (prev.rows[0]?.sources_hash === hash) return trail;

  const found = await extractRequirements(sources, cfg.model);
  for (const r of found) {
    await db().query(
      `insert into requirements (id,trail_id,text,type,confidence,testable,untestable_reason,source_kind,source_session_id,source_message_id,quote)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict do nothing`,
      [randomUUID(), trail.id, r.text, r.type, r.confidence, r.testable, r.reason, r.sourceKind,
       r.sourceKind === "session" ? r.sourceId : null, r.messageId, r.quote],
    );
  }
  // Only after a successful extraction, so a Gemini failure is retried on the next push.
  await db().query("update trails set sources_hash=$2 where id=$1", [trail.id, hash]);
  cfg.log?.(`${trail.title}: ${found.length} requirements extracted`);
  return trail;
}

type Pending = { id: string; text: string; kind: "new" | "regression" };

async function selectRequirements(trailId: string): Promise<Pending[]> {
  // New: this Trail's live asks (proposed or approved). Regression: approved asks of merged Trails.
  const { rows } = await db().query(
    `select id, text, trail_id = $1 as is_new from requirements
     where testable and (
       (trail_id = $1 and status in ('proposed','approved'))
       or (trail_id <> $1 and status = 'approved' and trail_id in (select id from trails where state = 'merged')))
     order by trail_id = $1 desc, text`,
    [trailId],
  );
  return rows.map((r) => ({ id: r.id, text: r.text, kind: r.is_new ? "new" : "regression" }));
}

const headSha = async (cfg: Config, branch: string) =>
  (await execGit("git", ["ls-remote", "origin", branch], { cwd: cfg.repoDir })).stdout.split("\t")[0] || "unknown";

/** One Trail push: sync merged Trails and this Trail, run every requirement in parallel, file findings. */
export async function processTrail(cfg: Config, ref: TrailRef): Promise<{ runId: string; passed: number; failed: number; errored: number }> {
  for (const n of await closedTrailNumbers(cfg.project)) {
    if (n === ref.trail) continue;
    try {
      await syncTrail(cfg, { project: cfg.project, trail: n });
    } catch (e) {
      cfg.log?.(`merged Trail ${n} not synced: ${String(e).slice(0, 120)}`);
    }
  }
  const trail = await syncTrail(cfg, ref);
  const sha = trail.branch ? await headSha(cfg, trail.branch) : "unknown";
  const reqs = await selectRequirements(trail.id);
  const runId = randomUUID();
  await db().query("insert into runs (id,trail_id,head_sha) values ($1,$2,$3)", [runId, trail.id, sha]);
  await db().query("update trails set last_head_sha=$2 where id=$1", [trail.id, sha]);
  cfg.log?.(`run ${runId}: ${reqs.length} requirements (${reqs.filter((r) => r.kind === "new").length} new)`);

  const results: (CheckResult & { checkId: string })[] = [];
  let errored = 0;
  await pool(cfg.concurrency, reqs, async (r) => {
    const checkId = randomUUID();
    try {
      const c = await compileRequirement(r, cfg.model);
      if (!c.testable) {
        await db().query("update requirements set testable=false, untestable_reason=$2 where id=$1", [r.id, c.reason]);
        return cfg.log?.(`SKIP ${r.text}: ${c.reason}`);
      }
      await db().query("insert into checks (id,run_id,requirement_id,goal) values ($1,$2,$3,$4)", [checkId, runId, r.id, c.goal]);
      const t = Date.now();
      const run = await runCheck(c.goal, cfg.targetUrl, {
        onStreamingUrl: (u) => void db().query("update checks set streaming_url=$2 where id=$1", [checkId, u]),
      });
      const v = toVerdict(run);
      await db().query(
        "update checks set tinyfish_run_id=$2, passed=$3, failed_step=$4, reason=$5, streaming_url=coalesce($6,streaming_url), duration_ms=$7 where id=$1",
        [checkId, run.runId, v.state === "errored" ? null : v.state === "passed", v.failedStep, v.reason, run.streamingUrl, Date.now() - t],
      );
      for (const [i, purpose] of run.steps.entries()) {
        await db().query("insert into steps (check_id,index,purpose) values ($1,$2,$3)", [checkId, i + 1, purpose]);
      }
      cfg.log?.(`${v.state.toUpperCase()} ${r.text}`);
      if (v.state === "errored") errored++;
      else results.push({ checkId, requirementId: r.id, requirementText: r.text, passed: v.state === "passed", failedStep: v.failedStep, reason: v.reason });
    } catch (e) {
      errored++;
      cfg.log?.(`ERRORED ${r.text}: ${String(e).slice(0, 160)}`);
    }
  });

  for (const a of decideFindings(await openFindings(ref), results)) {
    if (a.kind === "resolve") {
      await resolveFinding(a.findingId, a.message, ref);
      continue;
    }
    const findingId = await addFinding(a.requirementId, a.title, a.body, ref);
    const checkId = results.find((x) => x.requirementId === a.requirementId)!.checkId;
    await db().query(
      "insert into bug_reports (id,check_id,finding_id,summary_md) values ($1,$2,$3,$4)",
      [randomUUID(), checkId, findingId, `**${a.title}**\n\n${a.body}`],
    );
    cfg.log?.(`finding ${findingId} filed`);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  await db().query("update runs set finished_at=now(), passed_count=$2, failed_count=$3 where id=$1", [runId, passed, failed]);
  return { runId, passed, failed, errored };
}

/** Skip pushes we already ran, so our own findings (which also emit Trail events) never loop. */
export async function needsRun(cfg: Config, ref: TrailRef): Promise<boolean> {
  const trail = await showTrail(ref);
  if (!trail.branch) return true;
  const { rows } = await db().query("select last_head_sha from trails where id=$1", [trail.id]);
  return rows[0]?.last_head_sha !== (await headSha(cfg, trail.branch));
}
