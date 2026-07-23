-- Day 2 schema: shared moves + tasks.
-- Access model: no auth. Each move has a random share_token (UUID). The client
-- passes it as an `x-share-token` header on every request; RLS policies gate
-- rows by matching that header against the move's share_token. Anyone who
-- knows a move's URL can read/write it; nobody else can. Fine for a two-person
-- shared move; NOT fine for a public product without adding real auth.

create extension if not exists "pgcrypto";

-- ---------- Types ----------

create type task_category as enum (
  'packing',
  'admin',
  'utilities',
  'logistics',
  'post_move',
  'other'
);

create type task_status as enum ('todo', 'done');

-- ---------- Tables ----------

create table moves (
  id              uuid primary key default gen_random_uuid(),
  share_token     uuid not null unique default gen_random_uuid(),
  move_date       date,
  current_address text,
  new_address     text,
  created_at      timestamptz not null default now()
);

create table tasks (
  id                     uuid primary key default gen_random_uuid(),
  move_id                uuid not null references moves(id) on delete cascade,
  title                  text not null,
  notes                  text,
  due_at                 timestamptz,
  category               task_category not null default 'other',
  status                 task_status   not null default 'todo',
  reminder_offsets_minutes int[]       not null default '{}',
  sort_order             int           not null default 0,
  created_at             timestamptz   not null default now(),
  updated_at             timestamptz   not null default now()
);

create index tasks_move_id_idx on tasks(move_id);
create index tasks_due_at_idx  on tasks(due_at) where due_at is not null;

-- ---------- updated_at trigger ----------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ---------- Bootstrap RPC ----------
-- Creating a move is the one operation that can't be gated by a share_token
-- (the caller doesn't have one yet). SECURITY DEFINER lets anon insert here
-- without needing RLS access to the base table.

create or replace function create_move(
  p_move_date       date default null,
  p_current_address text default null,
  p_new_address     text default null
) returns table (id uuid, share_token uuid)
language sql security definer set search_path = public as $$
  insert into moves (move_date, current_address, new_address)
  values (p_move_date, p_current_address, p_new_address)
  returning moves.id, moves.share_token;
$$;

grant execute on function create_move to anon;

-- ---------- RLS ----------

alter table moves enable row level security;
alter table tasks enable row level security;

-- Helper: extract share_token from the request headers set by supabase-js.
create or replace function current_share_token() returns uuid
language sql stable as $$
  select nullif(
    current_setting('request.headers', true)::json->>'x-share-token',
    ''
  )::uuid;
$$;

create policy moves_by_token on moves
  for all
  using      (share_token = current_share_token())
  with check (share_token = current_share_token());

create policy tasks_by_move_token on tasks
  for all
  using (
    exists (
      select 1 from moves
      where moves.id = tasks.move_id
        and moves.share_token = current_share_token()
    )
  )
  with check (
    exists (
      select 1 from moves
      where moves.id = tasks.move_id
        and moves.share_token = current_share_token()
    )
  );

-- ---------- Realtime ----------
-- Enable realtime for tasks so both devices sync live.

alter publication supabase_realtime add table tasks;
