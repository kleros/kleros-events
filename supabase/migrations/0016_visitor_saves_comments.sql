-- Visitors: save talks and files, and comment on events and talks. Safe to run more than once.
--
--   * material_saves: a signed-in visitor's saved talks, slides and links (events are saved with
--     attendance status 'saved', as before). Only the visitor sees their own saves.
--   * comments: on an event or on one talk/file. Everyone who can see the event or talk reads them;
--     anyone signed in with a confirmed email (not a QR guest) can post; the author deletes their own,
--     and whoever may edit the event or talk can delete any (moderation). The name shown is taken from
--     the author's profile by the database, so nobody can post under another name.
--
-- Until this runs the site hides the talk Save buttons and the comments, and the Saved page lists
-- saved events only.

-- ---------- saved talks and files ----------
create table if not exists material_saves (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  material_id uuid not null references materials on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, material_id)
);
create index if not exists material_saves_material on material_saves (material_id);
alter table material_saves enable row level security;

drop policy if exists "own saves" on material_saves;
drop policy if exists "save visible materials" on material_saves;
drop policy if exists "remove own saves" on material_saves;
create policy "own saves" on material_saves for select to authenticated using (user_id = auth.uid());
create policy "save visible materials" on material_saves for insert to authenticated
  with check (user_id = auth.uid() and my_email() is not null and material_visible(material_id));
create policy "remove own saves" on material_saves for delete to authenticated using (user_id = auth.uid());
revoke all on material_saves from anon;
revoke update on material_saves from authenticated;
grant select, insert, delete on material_saves to authenticated;

-- ---------- comments ----------
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events on delete cascade,
  material_id uuid references materials on delete cascade,
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  author_name text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check ((event_id is null) <> (material_id is null))
);
create index if not exists comments_event on comments (event_id, created_at);
create index if not exists comments_material on comments (material_id, created_at);
alter table comments enable row level security;

-- The author, their shown name and the time come from the database, never from the browser.
create or replace function comments_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_id := auth.uid();
  new.author_name := coalesce(
    (select nullif(btrim(p.display_name), '') from profiles p where p.id = auth.uid()),
    'Visitor');
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;
drop trigger if exists comments_stamp on comments;
create trigger comments_stamp before insert on comments for each row execute function comments_stamp();

-- Who can see the thing commented on.
create or replace function comment_target_visible(p_event uuid, p_material uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_event is not null then can_see_event(p_event)
              when p_material is not null then material_visible(p_material)
              else false end
$$;
-- Who looks after the thing commented on (moderation).
create or replace function comment_target_editable(p_event uuid, p_material uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_event is not null then can_edit_event(p_event)
              when p_material is not null then material_editable(p_material)
              else false end
$$;

drop policy if exists "comments are visible with their event or talk" on comments;
drop policy if exists "signed-in visitors comment" on comments;
drop policy if exists "authors and editors delete comments" on comments;
create policy "comments are visible with their event or talk" on comments for select
  using (comment_target_visible(event_id, material_id));
create policy "signed-in visitors comment" on comments for insert to authenticated
  with check (author_id = auth.uid() and my_email() is not null and comment_target_visible(event_id, material_id));
create policy "authors and editors delete comments" on comments for delete to authenticated
  using (author_id = auth.uid() or comment_target_editable(event_id, material_id));
revoke insert, update, delete on comments from anon, authenticated;
grant select on comments to anon, authenticated;
grant insert (event_id, material_id, body), delete on comments to authenticated;
