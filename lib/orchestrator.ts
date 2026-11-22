import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { compileRequirement, renderFeatureGoal, type CheckSpec, type StructuredModel } from "./compile";
import { db } from "./db";
import {
  addFinding, mergedTrailNumbers, postSummary, openFindings, resolveFinding, sessionTranscript, showTrail,
  trailSessionIds, type TrailInfo, type TrailRef,
} from "./entire";
import { extractRequirements, type Source } from "./extract";
import { decideFindings, type CheckResult } from "./findings";
import { runFeature } from "./tinyfish";
import { parseTranscript } from "./transcript";
import { toFeatureVerdicts, type Verdict } from "./verdict";
import { needsSecondRun, reconcile } from "./confirm";
import { recommend } from "./recommendation";
import { saveReplay } from "./replay";
import type { CheckRun } from "./tinyfish";

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

  // Approved requirements anywhere in the project, so a message that changes one is flagged as drift.
  const existing = (await db().query("select id, text from requirements where status='approved' and testable")).rows as { id: string; text: string }[];
  const found = await extractRequirements(sources, cfg.model, existing);
  for (const r of found) {
    await db().query(
      `insert into requirements (id,trail_id,text,type,confidence,testable,untestable_reason,source_kind,source_session_id,source_message_id,quote,supersedes_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict do nothing`,
      [randomUUID(), trail.id, r.text, r.type, r.confidence, r.testable, r.reason, r.sourceKind,
       r.sourceKind === "session" ? r.sourceId : null, r.messageId, r.quote, r.supersedes],
    );
  }
  // Only after a successful extraction, so a Gemini failure is retried on the next push.
  await db().query("update trails set sources_hash=$2 where id=$1", [trail.id, hash]);
  cfg.log?.(`${trail.title}: ${found.length} requirements extracted`);
  return trail;
}

type Pending = { id: string; text: string; kind: "new" | "regression"; feature: string | null };

async function selectRequirements(trailId: string): Promise<Pending[]> {
  // New: this Trail's live asks (proposed or approved). Regression: approved asks of merged Trails.
  const { rows } = await db().query(
    `select id, text, feature, trail_id = $1 as is_new from requirements
     where testable and (
       (trail_id = $1 and status in ('proposed','approved'))
       or (trail_id <> $1 and status = 'approved' and trail_id in (select id from trails where state = 'merged')))
     order by trail_id = $1 desc, feature nulls last, text`,
    [trailId],
  );
  return rows.map((r) => ({ id: r.id, text: r.text, kind: r.is_new ? "new" : "regression", feature: r.feature }));
}

const headSha = async (cfg: Config, branch: string) =>
  (await execGit("git", ["ls-remote", "origin", branch], { cwd: cfg.repoDir })).stdout.split("\t")[0] || (() => { throw new Error(`branch ${branch} not found on origin`); })();

/** One Trail push: sync merged Trails and this Trail, run every requirement in parallel, file findings. */
export async function processTrail(cfg: Config, ref: TrailRef): Promise<{ runId: string; passed: number; failed: number; errored: number; needsReview: number }> {
  for (const n of await mergedTrailNumbers(cfg.project)) {
    if (n === ref.trail) continue;
    try {
      await syncTrail(cfg, { project: cfg.project, trail: n });
    } catch (e) {
      cfg.log?.(`merged Trail ${n} not synced: ${String(e).slice(0, 120)}`);
    }
  }
  const trail = await syncTrail(cfg, ref);
  const sha = trail.branch ? await headSha(cfg, trail.branch) : "no-branch";
  const reqs = await selectRequirements(trail.id);
  const runId = randomUUID();
  await db().query("insert into runs (id,trail_id,head_sha) values ($1,$2,$3)", [runId, trail.id, sha]);
  cfg.log?.(`run ${runId}: ${reqs.length} requirements (${reqs.filter((r) => r.kind === "new").length} new)`);

  const results: (CheckResult & { checkId: string })[] = [];
  let errored = 0;
  let review = 0; // flaky or unconfirmed: shown to a human, never a finding
  // One browser session per feature, its requirements as sequential checks. No feature means a session of one.
  const groups = new Map<string, Pending[]>();
  for (const r of reqs) {
    const key = r.feature ? `${r.kind}:${r.feature}` : `single:${r.id}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  await pool(cfg.concurrency, [...groups.values()], async (group) => {
    const compiled: { r: Pending; spec: CheckSpec; goal: string; checkId: string }[] = [];
    for (const r of group) {
      try {
        const c = await compileRequirement(r, cfg.model);
        if (!c.testable) {
          await db().query("update requirements set testable=false, untestable_reason=$2 where id=$1", [r.id, c.reason]);
          cfg.log?.(`SKIP ${r.text}: ${c.reason}`);
          continue;
        }
        compiled.push({ r, spec: c.spec, goal: c.goal, checkId: randomUUID() });
      } catch (e) {
        errored++;
        cfg.log?.(`ERRORED ${r.text}: ${String(e).slice(0, 160)}`);
      }
    }
    if (!compiled.length) return;
    const label = group[0].feature ?? group[0].text.slice(0, 50);
    try {
      const goal = renderFeatureGoal(compiled.map((c) => c.spec));
      for (const c of compiled) {
        await db().query("insert into checks (id,run_id,requirement_id,goal) values ($1,$2,$3,$4)", [c.checkId, runId, c.r.id, goal]);
      }
      const t = Date.now();
      // One session for the feature. Anything that did not pass gets exactly one more session of its own, so a
      // single misread or a dropped check never files a bug: a bug needs two agreeing failures.
      const session = async (items: typeof compiled, tag: string) => {
        cfg.log?.(`session "${label}"${tag}: ${items.length} checks`);
        const ids = items.map((c) => c.checkId);
        const run = await runFeature(renderFeatureGoal(items.map((c) => c.spec)), cfg.targetUrl, items.length, {
          onStreamingUrl: (u) => void db().query("update checks set streaming_url=$2 where id = any($1)", [ids, u]),
        });
        // The stream is dead once the session ends. Clear it so the live view never embeds a finished browser.
        await db().query("update checks set streaming_url=null where id = any($1)", [ids]);
        // Download the screenshots and recording right away, the video link expires. A failure here never loses a verdict.
        const replay = run.runId ? await saveReplay(run.runId).catch((e) => { cfg.log?.(`replay not saved: ${String(e).slice(0, 100)}`); return null; }) : null;
        return { run, replay, verdicts: toFeatureVerdicts(run, items.length) };
      };
      const attempt = (run: CheckRun) => ({ runId: run.runId, status: run.status, error: run.error, result: run.result, streamingUrl: run.streamingUrl });
      const first = await session(compiled, "");
      const retry = compiled.filter((_, i) => needsSecondRun(first.verdicts[i]));
      const second = retry.length ? await session(retry, " (confirming)") : null;
      for (const [i, c] of compiled.entries()) {
        const j = retry.indexOf(c);
        const v2: Verdict | null = second && j >= 0 ? second.verdicts[j] : null;
        const final = reconcile(first.verdicts[i], v2);
        const last = v2 ? second!.run : first.run;
        await db().query(
          `update checks set tinyfish_run_id=$2, passed=$3, failed_step=$4, reason=$5, streaming_url=coalesce($6,streaming_url),
             duration_ms=$7, classification=$8, attempts=$9, raw_result=$10, video_path=$11, session_pos=$12 where id=$1`,
          [c.checkId, last.runId, final.state === "passed" ? true : final.state === "failed" ? false : null, final.failedStep, final.reason,
           last.streamingUrl, Date.now() - t, final.classification, v2 ? 2 : 1, JSON.stringify(v2 ? [attempt(first.run), attempt(second!.run)] : [attempt(first.run)]),
           (v2 ? second!.replay : first.replay)?.video ?? null, (v2 ? retry.indexOf(c) : i) + 1],
        );
        // The session's steps are shared by its checks, so each check keeps the whole list of its last session.
        const rp = (v2 ? second!.replay : first.replay)?.steps ?? [];
        if (rp.length) {
          for (const [k, st] of rp.entries()) {
            await db().query("insert into steps (check_id,index,action,screenshot_path,duration_s,at) values ($1,$2,$3,$4,$5,$6)", [c.checkId, k + 1, st.action, st.file, st.durationS, st.at]);
          }
        } else {
          for (const [k, purpose] of last.steps.entries()) {
            await db().query("insert into steps (check_id,index,purpose) values ($1,$2,$3)", [c.checkId, k + 1, purpose]);
          }
        }
        cfg.log?.(`${final.state.toUpperCase()}${final.classification ? ` (${final.classification})` : ""} ${c.r.text}`);
        if (final.state === "errored") errored++;
        else if (final.state === "needs_review") review++;
        else results.push({ checkId: c.checkId, requirementId: c.r.id, requirementText: c.r.text, passed: final.state === "passed", failedStep: final.failedStep, reason: final.reason });
      }
    } catch (e) {
      errored += compiled.length;
      cfg.log?.(`ERRORED session "${label}": ${String(e).slice(0, 160)}`);
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  try {
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
    const rec = recommend({
      total: results.length + review + errored, passed, failed, needsReview: review, errored,
      failures: results.filter((r) => !r.passed).map((r) => ({ text: r.requirementText, reason: r.reason })),
    });
    await postSummary(rec.text, ref);
    cfg.log?.(`recommendation: ${rec.verdict}`);
  } finally {
    // The run row is always closed out, and an all-errored run shows as errored, not as 0 failures.
    await db().query("update runs set finished_at=now(), passed_count=$2, failed_count=$3, errored_count=$4 where id=$1", [runId, passed, failed, errored]);
  }
  // Marked done only now, so a run that threw is picked up again on the next event.
  await db().query("update trails set last_head_sha=$2 where id=$1", [trail.id, sha]);
  return { runId, passed, failed, errored, needsReview: review };
}

/** Skip pushes we already ran, so our own findings (which also emit Trail events) never loop. */
export async function needsRun(cfg: Config, ref: TrailRef): Promise<boolean> {
  const trail = await showTrail(ref);
  if (!trail.branch) return true;
  const { rows } = await db().query("select last_head_sha from trails where id=$1", [trail.id]);
  return rows[0]?.last_head_sha !== (await headSha(cfg, trail.branch));
}
