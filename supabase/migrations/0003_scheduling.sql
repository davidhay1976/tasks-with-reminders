-- Day 4: turn tasks into optional appointments.
-- Any task with starts_at set is an appointment; duration_minutes gives
-- length; contact stores whoever's coming (name / phone / freeform).

alter table tasks
  add column starts_at        timestamptz,
  add column duration_minutes int,
  add column contact          text;

create index tasks_move_starts_idx
  on tasks(move_id, starts_at)
  where starts_at is not null;
