-- Receipts schema. Idempotent: safe to run repeatedly.
create table if not exists trails (
  id text primary key,
  title text not null,
  description text not null default '',
  branch text not null,
  state text not null check (state in ('open','merged')),
  last_head_sha text
);

create table if not exists requirements (
  id text primary key,
  trail_id text not null references trails(id),
  text text not null,
  type text not null check (type in ('behaviour','validation','access','visual')),
  confidence real not null,
  testable boolean not null,
  untestable_reason text,
  status text not null default 'proposed'
    check (status in ('proposed','approved','rejected','superseded')),
  source_kind text not null check (source_kind in ('description','session','manual')),
  source_session_id text,
  source_message_id text,
  quote text,
  brain_path text,
  edited_by_human boolean not null default false
);

create table if not exists runs (
  id text primary key,
  trail_id text not null references trails(id),
  head_sha text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  passed_count int not null default 0,
  failed_count int not null default 0
);
create index if not exists runs_trail_started on runs (trail_id, started_at desc);

create table if not exists checks (
  id text primary key,
  run_id text not null references runs(id),
  requirement_id text not null references requirements(id),
  tinyfish_run_id text,
  goal text not null,
  passed boolean,
  failed_step int,
  reason text,
  streaming_url text,
  video_path text,
  duration_ms int
);

create table if not exists steps (
  check_id text not null references checks(id),
  index int not null,
  action text,
  purpose text,
  screenshot_path text,
  primary key (check_id, index)
);

create table if not exists bug_reports (
  id text primary key,
  check_id text not null references checks(id),
  finding_id text,
  summary_md text,
  repro_md text,
  file text,
  line int,
  commit_sha text,
  checkpoint_id text,
  prompt_session_id text,
  prompt_message_id text
);

-- Skip re-extraction when a Trail's sources have not changed (Gemini credits are limited).
alter table trails add column if not exists sources_hash text;
create unique index if not exists requirements_trail_text on requirements (trail_id, lower(text));
alter table runs add column if not exists errored_count int not null default 0;

-- One browser session per feature: requirements that share a feature run as sequential checks in it.
alter table requirements add column if not exists feature text;
