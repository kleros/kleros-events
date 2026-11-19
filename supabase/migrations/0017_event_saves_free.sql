-- Save an event and say "I'm going" at the same time, and mark events that are free. Safe to run more
-- than once. Nothing is deleted: the "drop ... if exists" lines only reset this file's own rules.
--
--   * event_saves: the visitor's saved events, on their own, so Save and I'm going / I was there can both be
--     on. Events saved before (attendance status 'saved') are copied in; their rows stay for the notes.
--   * events.is_free: shows "Get tickets (free)". ETHChiangmai 2026 is set as free.
--
-- Until this runs, Save and I'm going keep working the old way (one or the other).

create table if not exists event_saves (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  event_id uuid not null references events on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index if not exists event_saves_event on event_saves (event_id);
alter table event_saves enable row level security;

drop policy if exists "own event saves" on event_saves;
drop policy if exists "save visible events" on event_saves;
drop policy if exists "remove own event saves" on event_saves;
create policy "own event saves" on event_saves for select to authenticated using (user_id = auth.uid());
create policy "save visible events" on event_saves for insert to authenticated
  with check (user_id = auth.uid() and my_email() is not null and can_see_event(event_id));
create policy "remove own event saves" on event_saves for delete to authenticated using (user_id = auth.uid());
revoke all on event_saves from anon;
revoke update on event_saves from authenticated;
grant select, insert, delete on event_saves to authenticated;

-- earlier saves carry over
insert into event_saves (user_id, event_id, created_at)
  select a.user_id, a.event_id, a.updated_at from attendance a where a.status = 'saved'
  on conflict do nothing;

alter table events add column if not exists is_free boolean;
update events set is_free = true where slug = 'ethchiangmai-chiang-mai-2026' and is_free is null;
