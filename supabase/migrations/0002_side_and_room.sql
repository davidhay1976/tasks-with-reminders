-- Day 3 addition: international-move support.
-- Tasks now belong to a side (origin USA / destination Israel / both) and can
-- be scoped to a specific room. Rooms are free-form text so users can add
-- their own without a schema change.

alter table tasks
  add column side text not null default 'both'
    check (side in ('origin', 'destination', 'both')),
  add column room text;

create index tasks_move_side_idx on tasks(move_id, side);
create index tasks_move_room_idx on tasks(move_id, room);

-- Moves optionally record the country pair, so future generalization is easy.
alter table moves
  add column origin_country      text default 'USA',
  add column destination_country text default 'Israel';
