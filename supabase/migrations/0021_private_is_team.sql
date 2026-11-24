-- 0021: private now means "the Kleros team" (Wei Wei, 24 November 2026). Needs 0010 and 0012.
-- All or nothing (one transaction), safe to run more than once, deletes no rows.
--
-- Before: a private event was seen only by its creator and the collaborators they added by email;
-- other team members and admins could not open it.
-- Now:
--   * public:  the general public (once published), as before.
--   * private: internal to Kleros. Everyone on the team (a confirmed @kleros.io account, or access
--              an admin granted, admins included) sees and edits it, its agenda, files, recordings,
--              transcripts, questions, live screen and RSVPs. It never shows on the public site.
--   * Guests: the collaborators list stays, for people outside the team (a partner, a speaker).
--              Signing in with the listed email lets them see and edit that one private event.
--   * Switching public/private and deleting a private event: its creator or an admin.
--     (Other team members edit it but do not delete it or publish it.)
--
-- Almost every rule reads is_event_member(); widening it to the team carries the change to
-- questions, materials, files, RSVPs, the live screen and the collaborators list.

begin;

do $$
begin
  if to_regprocedure('public.is_event_member(uuid)') is null
     or to_regprocedure('public.events_visibility_changed()') is null then
    raise exception 'Run migrations 0010 and 0012 first, then run this file again.';
  end if;
end $$;

-- ---------- who counts as a member of a private event ----------
-- The team, the creator, or a collaborator invited by email.
create or replace function is_event_member(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    is_team() or exists (
      select 1 from events e
       where e.id = p_event
         and (e.created_by = auth.uid() or is_event_collaborator(e.id))))
$$;

-- ---------- events ----------
-- Checked on the row's own columns (a row being inserted is not visible to a lookup yet).
drop policy if exists "events visible to the caller" on events;
drop policy if exists "editors update events" on events;
drop policy if exists "owners delete events" on events;
create policy "events visible to the caller" on events for select
  using (case when visibility = 'private' then is_team() or created_by = auth.uid() or is_event_collaborator(id)
              else status = 'published' or is_team() end);
create policy "editors update events" on events for update to authenticated
  using (case when visibility = 'private' then is_team() or created_by = auth.uid() or is_event_collaborator(id) else is_team() end)
  with check (case when visibility = 'private' then is_team() or created_by = auth.uid() or is_event_collaborator(id)
                   else is_team() end);
create policy "owners delete events" on events for delete to authenticated
  using (case when visibility = 'private' then created_by = auth.uid() or is_admin() else is_team() end);

-- ---------- switching public/private: the creator or an admin ----------
-- Same as 0012 except for the two permission checks.
create or replace function events_keep_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('app.importing', true), '') <> 'on' then
      new.created_by := coalesce(new.created_by, auth.uid());
    end if;
    if auth.uid() is not null then new.public_slug := null; new.luma_hidden := null; end if;
  else
    if auth.uid() is not null and new.visibility is distinct from old.visibility then
      if not coalesce(old.created_by = auth.uid() or is_admin(), false) then
        raise exception 'Only the person who created this event, or an admin, can change who sees it.' using errcode = '42501';
      end if;
      if new.visibility = 'public' and not is_team() then
        raise exception 'Making an event public needs a Kleros team account.' using errcode = '42501';
      end if;
    end if;
    -- a creator is only given when an event without one is made private
    if auth.uid() is not null and pg_trigger_depth() = 1 then
      new.created_by := coalesce(old.created_by, case when old.visibility = 'public' and new.visibility = 'private' then auth.uid() end);
    end if;
    -- kept by the rules below; only the SQL editor and the jobs may set them directly
    if auth.uid() is not null then new.public_slug := old.public_slug; new.luma_hidden := old.luma_hidden; end if;
  end if;

  -- made private: its Luma event stays off the site (see sync_luma)
  if tg_op = 'UPDATE' and old.visibility = 'public' and new.visibility = 'private' then
    new.luma_hidden := luma_slug(old.url);
  end if;
  -- an edit form sends back the plain part of a private event's address: not a new address
  if tg_op = 'UPDATE' and old.visibility = 'private' and old.public_slug is not null and new.slug = old.public_slug then
    new.slug := old.slug;
  end if;
  -- a private event's address ends in a random part, so nobody outside can guess it
  if new.visibility = 'private' and (tg_op = 'INSERT' or new.slug is distinct from old.slug) then
    new.public_slug := new.slug;
    new.slug := new.slug || '-' || left(md5(gen_random_uuid()::text), 8);
  elsif tg_op = 'UPDATE' and old.visibility = 'private' and new.visibility = 'public' then
    if new.slug = old.slug and old.public_slug is not null
       and not exists (select 1 from events where slug = old.public_slug and id <> new.id) then
      new.slug := old.public_slug;
    end if;
    new.public_slug := null;
    new.luma_hidden := null;
  end if;

  -- a private event never counts as published, so making it public later starts as a draft
  if new.visibility = 'private' then new.status := 'draft'; end if;
  return new;
end $$;
revoke all on function events_keep_creator() from public, anon, authenticated;

-- ---------- files that go with a deleted private event: for its creator or an admin ----------
create or replace function private_event_files(p_event uuid) returns setof text
language sql stable security definer set search_path = public, storage as $$
  with mine as (   -- items that go with the event
    select m.id, m.file_path, m.pdf_path, m.audio_path from materials m
     where (m.event_id = p_event or exists (select 1 from material_events me where me.material_id = m.id and me.event_id = p_event))
       and not exists (select 1 from material_events me where me.material_id = m.id and me.event_id <> p_event)
  )
  select o.name from storage.objects o
   where o.bucket_id = 'materials'
     and exists (select 1 from events e where e.id = p_event and e.visibility = 'private'
                    and (e.created_by = auth.uid() or is_admin()))
     and (o.name like p_event::text || '/%'
          or exists (select 1 from mine where o.name in (mine.file_path, mine.pdf_path, mine.audio_path)))
     and not exists (select 1 from materials m
                      where o.name in (m.file_path, m.pdf_path, m.audio_path)
                        and m.id not in (select id from mine))
$$;
revoke all on function private_event_files(uuid) from public, anon;
grant execute on function private_event_files(uuid) to authenticated;

commit;

-- Check (should say 0021 ok):
select case when pg_get_functiondef('public.is_event_member(uuid)'::regprocedure) like '%is_team()%'
            then '0021 ok' else '0021 missing' end as result;
