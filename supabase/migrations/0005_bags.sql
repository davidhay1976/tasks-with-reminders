-- Day 5: luggage tracking.
-- Bags belong to a move, grouped by type. Carry-ons are paired by adjacent
-- sort_order (positions 1+2, 3+4, …) to check per-pair weight limits.
-- Photos live in the `bag-photos` Storage bucket; only the path is stored here.

create table bags (
  id          uuid primary key default gen_random_uuid(),
  move_id     uuid not null references moves(id) on delete cascade,
  type        text not null
    check (type in ('checked', 'carry_on', 'personal', 'other')),
  label       text,
  sort_order  int  not null default 0,
  contents    text,
  weight_kg   numeric(5,2),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index bags_move_type_sort_idx on bags(move_id, type, sort_order);

create trigger bags_set_updated_at
  before update on bags
  for each row execute function set_updated_at();

create table bag_photos (
  id           uuid primary key default gen_random_uuid(),
  bag_id       uuid not null references bags(id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create index bag_photos_bag_id_idx on bag_photos(bag_id);

-- ---------- RLS ----------

alter table bags       enable row level security;
alter table bag_photos enable row level security;

create policy bags_by_move_token on bags
  for all
  using (
    exists (
      select 1 from moves
      where moves.id = bags.move_id
        and moves.share_token = current_share_token()
    )
  )
  with check (
    exists (
      select 1 from moves
      where moves.id = bags.move_id
        and moves.share_token = current_share_token()
    )
  );

create policy bag_photos_by_move_token on bag_photos
  for all
  using (
    exists (
      select 1
      from bags
      join moves on moves.id = bags.move_id
      where bags.id = bag_photos.bag_id
        and moves.share_token = current_share_token()
    )
  )
  with check (
    exists (
      select 1
      from bags
      join moves on moves.id = bags.move_id
      where bags.id = bag_photos.bag_id
        and moves.share_token = current_share_token()
    )
  );

-- ---------- Storage bucket ----------
-- Public bucket. Paths are moves/<move_id>/<bag_id>/<uuid>.<ext>. Anyone with
-- the URL can view; matches the existing share-token-in-URL security model.
-- Uploads/deletes are open to anon — the app enforces which bag_id a file
-- belongs to via the bag_photos row (which IS gated by share_token).

insert into storage.buckets (id, name, public)
values ('bag-photos', 'bag-photos', true)
on conflict (id) do nothing;

create policy "bag-photos anon read"   on storage.objects for select              using (bucket_id = 'bag-photos');
create policy "bag-photos anon insert" on storage.objects for insert with check   (bucket_id = 'bag-photos');
create policy "bag-photos anon update" on storage.objects for update using        (bucket_id = 'bag-photos') with check (bucket_id = 'bag-photos');
create policy "bag-photos anon delete" on storage.objects for delete              using (bucket_id = 'bag-photos');
