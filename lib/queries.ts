// All dashboard reads and writes against Postgres. Pages and API routes import from here only.
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { checkStatus, type CheckStatus } from "./report";

export type TrailRow = { id: string; title: string; description: string; branch: string; state: "open" | "merged"; requirements: number; lastRunAt: string | null };

export async function listTrails(): Promise<TrailRow[]> {
  const { rows } = await db().query(
    `select t.id, t.title, t.description, t.branch, t.state,
       (select count(*)::int from requirements r where r.trail_id = t.id) as requirements,
       (select max(started_at) from runs u where u.trail_id = t.id) as last_run_at
     from trails t order by (t.state = 'open') desc, last_run_at desc nulls last, t.title`,
  );
  return rows.map((r) => ({ ...r, lastRunAt: r.last_run_at?.toISOString() ?? null }));
}

export async function getTrail(id: string) {
  return (await db().query("select id, title, description, branch, state, last_head_sha from trails where id = $1", [id])).rows[0] as
    | { id: string; title: string; description: string; branch: string; state: "open" | "merged"; last_head_sha: string | null }
    | undefined;
}

export type RequirementRow = {
  id: string;
  trailId: string;
  trailTitle: string;
  text: string;
  type: "behaviour" | "validation" | "access" | "visual";
  confidence: number;
  testable: boolean;
  untestableReason: string | null;
  status: "proposed" | "approved" | "rejected" | "superseded";
  sourceKind: "description" | "session" | "manual";
  quote: string | null;
  edited: boolean;
  /** The earlier requirement this one changes (drift). It stays active until this one is approved. */
  supersedes: { id: string; text: string } | null;
};

const reqCols = `r.id, r.trail_id, t.title as trail_title, r.text, r.type, r.confidence, r.testable, r.untestable_reason,
  r.status, r.source_kind, r.quote, r.edited_by_human, s.id as sup_id, s.text as sup_text`;
const toReq = (r: Record<string, never>): RequirementRow => ({
  id: r.id, trailId: r.trail_id, trailTitle: r.trail_title, text: r.text, type: r.type, confidence: r.confidence,
  testable: r.testable, untestableReason: r.untestable_reason, status: r.status, sourceKind: r.source_kind,
  quote: r.quote, edited: r.edited_by_human,
  supersedes: r.sup_id ? { id: r.sup_id, text: r.sup_text } : null,
});

/** New: this Trail's own asks. Regression: approved asks of other merged Trails (what the orchestrator also runs). */
export async function listRequirements(trailId: string): Promise<{ fresh: RequirementRow[]; regression: RequirementRow[] }> {
  const fresh = await db().query(
    `select ${reqCols} from requirements r join trails t on t.id = r.trail_id left join requirements s on s.id = r.supersedes_id where r.trail_id = $1
     order by array_position(array['proposed','approved','rejected','superseded'], r.status), r.testable desc, r.text`,
    [trailId],
  );
  const regression = await db().query(
    `select ${reqCols} from requirements r join trails t on t.id = r.trail_id left join requirements s on s.id = r.supersedes_id
     where r.trail_id <> $1 and r.status = 'approved' and t.state = 'merged' order by t.title, r.text`,
    [trailId],
  );
  return { fresh: fresh.rows.map(toReq), regression: regression.rows.map(toReq) };
}

export type Status = RequirementRow["status"];

/** The requirement this one is meant to replace, if any. */
export async function supersededBy(id: string): Promise<string | null> {
  return (await db().query("select supersedes_id from requirements where id = $1", [id])).rows[0]?.supersedes_id ?? null;
}

export const setRequirementStatus = (id: string, status: Status) => db().query("update requirements set status = $2 where id = $1", [id, status]);

export async function requirementStatus(id: string): Promise<Status | undefined> {
  return (await db().query("select status from requirements where id = $1", [id])).rows[0]?.status;
}

export async function editRequirement(id: string, text: string) {
  await db().query("update requirements set text = $2, edited_by_human = true where id = $1", [id, text]);
}

export async function addManualRequirement(trailId: string, text: string, type: RequirementRow["type"]) {
  const id = randomUUID();
  await db().query(
    `insert into requirements (id, trail_id, text, type, confidence, testable, status, source_kind, edited_by_human)
     values ($1, $2, $3, $4, 1, true, 'approved', 'manual', true)`,
    [id, trailId, text, type],
  );
  return id;
}

export async function getRequirementSource(id: string) {
  return (await db().query("select r.trail_id, r.source_kind, r.source_session_id, r.source_message_id, r.quote, t.title, t.description from requirements r join trails t on t.id = r.trail_id where r.id = $1", [id])).rows[0] as
    | { trail_id: string; source_kind: string; source_session_id: string | null; source_message_id: string | null; quote: string | null; title: string; description: string }
    | undefined;
}

export type CheckRow = {
  id: string;
  requirementId: string;
  requirement: string;
  status: CheckStatus;
  reason: string | null;
  failedStep: number | null;
  streamingUrl: string | null;
  durationMs: number | null;
};
export type RunRow = { id: string; headSha: string; startedAt: string; finishedAt: string | null };
export type Live = { run: RunRow | null; checks: CheckRow[] };

export async function getLive(trailId: string): Promise<Live> {
  const run = (await db().query("select id, head_sha, started_at, finished_at from runs where trail_id = $1 order by started_at desc limit 1", [trailId])).rows[0];
  if (!run) return { run: null, checks: [] };
  const { rows } = await db().query(
    `select c.id, c.requirement_id, r.text, c.passed, c.reason, c.classification, c.failed_step, c.streaming_url, c.duration_ms
     from checks c join requirements r on r.id = c.requirement_id where c.run_id = $1 order by r.text`,
    [run.id],
  );
  const finished = !!run.finished_at;
  return {
    run: { id: run.id, headSha: run.head_sha, startedAt: run.started_at.toISOString(), finishedAt: run.finished_at?.toISOString() ?? null },
    checks: rows.map((c) => ({
      id: c.id, requirementId: c.requirement_id, requirement: c.text, status: checkStatus(c, finished), reason: c.reason,
      failedStep: c.failed_step, streamingUrl: c.streaming_url, durationMs: c.duration_ms,
    })),
  };
}

export type HistoryRow = {
  id: string; headSha: string; startedAt: string; durationMs: number | null;
  passed: number; failed: number; errored: number; failures: { checkId: string; requirement: string }[];
};

export async function listHistory(trailId: string): Promise<HistoryRow[]> {
  const runs = await db().query(
    "select id, head_sha, started_at, finished_at, passed_count, failed_count, errored_count from runs where trail_id = $1 order by started_at desc",
    [trailId],
  );
  const fails = await db().query(
    `select c.id, c.run_id, r.text from checks c join requirements r on r.id = c.requirement_id
     join runs u on u.id = c.run_id where u.trail_id = $1 and c.passed = false order by r.text`,
    [trailId],
  );
  return runs.rows.map((u) => ({
    id: u.id, headSha: u.head_sha, startedAt: u.started_at.toISOString(),
    durationMs: u.finished_at ? +u.finished_at - +u.started_at : null,
    passed: u.passed_count, failed: u.failed_count, errored: u.errored_count,
    failures: fails.rows.filter((f) => f.run_id === u.id).map((f) => ({ checkId: f.id, requirement: f.text })),
  }));
}

export type CheckDetail = {
  id: string; trailId: string; trailTitle: string; commit: string;
  requirementId: string; requirement: string; quote: string | null;
  status: CheckStatus; reason: string | null; failedStep: number | null; goal: string;
  steps: string[]; findingId: string | null; streamingUrl: string | null;
  file: string | null; line: number | null; checkpointId: string | null; promptSessionId: string | null; promptMessageId: string | null;
};

export async function getCheck(id: string): Promise<CheckDetail | undefined> {
  const c = (await db().query(
    `select c.id, c.goal, c.passed, c.reason, c.classification, c.failed_step, c.streaming_url, r.id as req_id, r.text, r.quote, t.id as trail_id, t.title, u.head_sha, u.finished_at
     from checks c join requirements r on r.id = c.requirement_id join runs u on u.id = c.run_id join trails t on t.id = u.trail_id where c.id = $1`, [id])).rows[0];
  if (!c) return;
  const steps = await db().query("select purpose from steps where check_id = $1 order by index", [id]);
  const b = (await db().query("select finding_id, file, line, commit_sha, checkpoint_id, prompt_session_id, prompt_message_id from bug_reports where check_id = $1 limit 1", [id])).rows[0];
  return {
    id: c.id, trailId: c.trail_id, trailTitle: c.title, commit: b?.commit_sha ?? c.head_sha, requirementId: c.req_id, requirement: c.text, quote: c.quote,
    status: checkStatus(c, !!c.finished_at), reason: c.reason, failedStep: c.failed_step, goal: c.goal,
    steps: steps.rows.map((s) => s.purpose ?? ""), findingId: b?.finding_id ?? null, streamingUrl: c.streaming_url,
    file: b?.file ?? null, line: b?.line ?? null, checkpointId: b?.checkpoint_id ?? null,
    promptSessionId: b?.prompt_session_id ?? null, promptMessageId: b?.prompt_message_id ?? null,
  };
}

export type Coverage = {
  asks: number;
  /** Testable and still live (proposed or approved) */
  live: number;
  /** Live asks that no run has ever checked */
  neverRun: string[];
  /** Asks that cannot be tested, with the reason */
  untestable: { text: string; reason: string }[];
};

/** Which of this Trail's stated asks are covered by a test, which are not yet, and which cannot be. */
export async function trailCoverage(trailId: string): Promise<Coverage> {
  const { rows } = await db().query(
    `select r.text, r.testable, r.untestable_reason, r.status, exists (select 1 from checks c where c.requirement_id = r.id) as ran
     from requirements r where r.trail_id = $1 and r.status in ('proposed','approved') order by r.text`,
    [trailId],
  );
  const live = rows.filter((r) => r.testable);
  return {
    asks: rows.length,
    live: live.length,
    neverRun: live.filter((r) => !r.ran).map((r) => r.text),
    untestable: rows.filter((r) => !r.testable).map((r) => ({ text: r.text, reason: r.untestable_reason ?? "no reason given" })),
  };
}
