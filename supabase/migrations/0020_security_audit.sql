-- 0020: fixes from the pre-launch database audit (19 November 2026). Needs 0001-0019 (0015 optional).
-- All or nothing (one transaction), safe to run more than once, deletes no rows.
--
--   1. talk_stats followed nobody's visibility: anyone could list the YouTube ids of private-event,
--      draft-event and library recordings. Now a row is visible exactly when its material is.
--   2. Comments: a limit per person (5 a minute, 50 a day; the team is not limited), the shown name
--      may no longer pass as the team ("Kleros", roster names, "admin"...) and is never the
--      untouched email local part (john.smith1987 from john.smith1987@gmail.com): those show as
--      "Visitor". Names are cut to 60 characters.
--   3. Meeting requests: created_at, user_id and handled are set by the database (a back-dated
--      created_at walked straight past the 0018 limits); signed-in visitors get their own limit and
--      are not stopped by the all-visitors flood limit; only the form's columns can be written.
--   4. Agenda and Kleros team of a draft event: no longer readable by everyone (they follow the
--      event, like materials do). Private events were already hidden.
--   5. team_access (emails, notes, who is blocked): admins only, as the /admin/access page already is.
--   6. Team by domain: only a plain address ends in @kleros.io (letters, digits, . _ + -), so
--      "x@evil.com?@kleros.io" or a quoted local part never counts as the team.
--   7. Other people's RSVP notes: no longer readable by every team member (the site never reads them).
--   8. Who added a collaborator / created an item: set by the database.
--   9. Hygiene: views are read-only for the API roles; internal oracles are not callable from the API;
--      the http extension's functions are not callable by anon/authenticated (only the jobs use them).

begin;

-- ---------- 0. what this file needs ----------
do $$
begin
  if to_regclass('public.talk_stats') is null or to_regclass('public.comments') is null
     or to_regprocedure('public.material_visible(uuid)') is null
     or to_regprocedure('public.question_name_reserved(text)') is null then
    raise exception 'Run migrations 0001 to 0019 first, then run this file again.';
  end if;
end $$;

-- ---------- 1. talk_stats follows its material ----------
drop policy if exists "talk stats are public" on talk_stats;
create policy "talk stats are public" on talk_stats for select using (material_visible(material_id));
revoke insert, update, delete, truncate, references, trigger on talk_stats, talk_stats_log from anon, authenticated;

-- ---------- 2. comments: limits and names ----------
create index if not exists comments_author_time on comments (author_id, created_at);

create or replace function comments_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_local text;
  v_minute int;
  v_day int;
begin
  new.author_id := v_uid;
  new.body := btrim(new.body);
  new.created_at := now();

  select nullif(btrim(p.display_name), ''), lower(split_part(u.email, '@', 1))
    into v_name, v_local
    from profiles p left join auth.users u on u.id = p.id
   where p.id = v_uid;
  v_name := left(question_name_clean(v_name), 60);
  if v_name is not null and not is_team() then
    -- an untouched profile name is the email's local part: do not publish it
    if lower(v_name) = v_local or question_name_reserved(v_name) then v_name := null; end if;
  end if;
  new.author_name := coalesce(v_name, 'Visitor');

  if v_uid is not null and not is_team() then
    perform pg_advisory_xact_lock(hashtext('kleros-comments:' || v_uid::text));
    select count(*) filter (where c.created_at > now() - interval '1 minute'),
           count(*) filter (where c.created_at > now() - interval '1 day')
      into v_minute, v_day
      from comments c
     where c.author_id = v_uid and c.created_at > now() - interval '1 day';
    if v_minute >= 5 then
      raise exception 'You can post up to 5 comments a minute. Wait a moment, then send it again.' using errcode = 'PT429';
    end if;
    if v_day >= 50 then
      raise exception 'You have posted 50 comments today, the most one person can post in a day.' using errcode = 'PT429';
    end if;
  end if;
  return new;
end $$;
revoke all on function comments_stamp() from public, anon, authenticated;
drop trigger if exists comments_stamp on comments;
create trigger comments_stamp before insert on comments for each row execute function comments_stamp();

-- ---------- 3. meeting requests ----------
create index if not exists meeting_requests_user_time on meeting_requests (user_id, created_at);

create or replace function meeting_request_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_signed_in boolean := my_email() is not null;   -- a confirmed, non-guest account
begin
  -- from the API, these are the database's, never the sender's. (current_user is this function's
  -- owner here; the role the request came in with is still in the role setting.)
  if v_uid is not null or current_setting('role', true) in ('anon', 'authenticated')
     or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') in ('anon', 'authenticated') then
    new.created_at := now();
    new.user_id := v_uid;
    new.handled := false;
  end if;
  new.email := btrim(new.email);
  if length(coalesce(new.name, '')) > 200 or length(coalesce(new.email, '')) > 200
     or length(coalesce(new.company, '')) > 200 or length(coalesce(new.interest, '')) > 100
     or length(coalesce(new.message, '')) > 4000 then
    raise exception 'The request is too long.' using errcode = '22001';
  end if;
  if new.email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please check the email address.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('kleros-meeting-requests'));
  if (select count(*) from meeting_requests
      where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many requests from this email. Please try again later.' using errcode = 'PT429';
  end if;
  if v_uid is not null and (select count(*) from meeting_requests
      where user_id = v_uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests from this account. Please try again later.' using errcode = 'PT429';
  end if;
  -- the flood limit stops visitors without an account (and guests); signed-in visitors have their own
  if not v_signed_in and (select count(*) from meeting_requests
      where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Too many requests right now. Please try again later.' using errcode = 'PT429';
  end if;
  return new;
end $$;
revoke all on function meeting_request_limits() from public, anon, authenticated;
drop trigger if exists meeting_request_limits on meeting_requests;
create trigger meeting_request_limits before insert on meeting_requests
  for each row execute function meeting_request_limits();

-- the forms send event_id, name, email, company, interest and message only
revoke insert on meeting_requests from anon, authenticated;
grant insert (event_id, name, email, company, interest, message) on meeting_requests to anon, authenticated;
revoke delete, truncate, references, trigger on meeting_requests from anon, authenticated;

-- ---------- 4. agenda and event team of drafts ----------
drop policy if exists "agenda is public" on agenda_items;
create policy "agenda is public" on agenda_items for select using (can_see_event(event_id));
drop policy if exists "event team is public" on event_team;
create policy "event team is public" on event_team for select using (can_see_event(event_id));

-- ---------- 5. access list: admins only ----------
drop policy if exists "team reads access list" on team_access;
drop policy if exists "admins read access list" on team_access;
create policy "admins read access list" on team_access for select using (is_admin());

-- ---------- 6. team by domain: plain addresses only ----------
create or replace function team_status_for(p_email text, p_confirmed boolean, p_is_admin boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when coalesce(p_is_admin, false) then true
    when not coalesce(p_confirmed, false) then false
    when p_email is null or btrim(p_email) = '' then false
    else coalesce(
      (select not ta.blocked from team_access ta where ta.email = lower(btrim(p_email))),
      lower(btrim(p_email)) ~ '^[a-z0-9._+-]+@kleros\.io$'
    )
  end
$$;
revoke execute on function team_status_for(text, boolean, boolean) from public, anon, authenticated;

-- accounts that were team only through an odd address that ends in @kleros.io lose it
update profiles p set is_team = false
  from auth.users u
 where u.id = p.id and p.is_team and not p.is_admin
   and lower(u.email) like '%@kleros.io'
   and lower(btrim(u.email)) !~ '^[a-z0-9._+-]+@kleros\.io$'
   and not exists (select 1 from team_access ta where ta.email = lower(btrim(u.email)) and not ta.blocked);

-- ---------- 7. RSVP notes stay with their author ----------
-- (event_counts, a view, still counts every RSVP; the site reads only the visitor's own rows)
drop policy if exists "team sees attendance" on attendance;

-- ---------- 8. who added / who created ----------
revoke insert on event_collaborators from anon, authenticated;
grant insert (event_id, email) on event_collaborators to authenticated;
revoke update, truncate, references, trigger on event_collaborators from anon, authenticated;

create or replace function materials_stamp_creator() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then new.created_by := auth.uid(); else new.created_by := old.created_by; end if;
  end if;
  return new;
end $$;
revoke all on function materials_stamp_creator() from public, anon, authenticated;
drop trigger if exists materials_stamp_creator on materials;
create trigger materials_stamp_creator before insert or update of created_by on materials
  for each row execute function materials_stamp_creator();

-- ---------- 9. hygiene ----------
-- views: read only
revoke insert, update, delete, truncate, references, trigger on question_scores, event_counts from anon, authenticated;
-- internal helpers that only answer "is this file used / is this item public" for any name or id;
-- no policy or page calls them directly (storage_file_visible and friends call them as the owner)
revoke execute on function storage_file_used(text) from public, anon, authenticated;
revoke execute on function storage_file_in_use(text, boolean) from public, anon, authenticated;
revoke execute on function material_is_public(uuid) from public, anon, authenticated;
-- tables nobody writes through the API
revoke insert, update, delete, truncate, references, trigger on luma_sync_log, feed_applied from anon, authenticated;

-- http extension: only the jobs (security definer, owned by postgres) use it
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
      join pg_depend d on d.objid = p.oid and d.deptype = 'e' and d.classid = 'pg_proc'::regclass
      join pg_extension x on x.oid = d.refobjid and x.extname = 'http'
  loop
    begin
      execute format('revoke execute on function %s from anon, authenticated', f);
      execute format('revoke execute on function %s from public', f);
      if not has_function_privilege('postgres', f, 'execute') then
        -- postgres only had it through PUBLIC: give it back rather than break the jobs
        execute format('grant execute on function %s to public', f);
        raise notice 'http: % is still callable through PUBLIC (postgres has no own grant)', f;
      end if;
    exception when insufficient_privilege then
      raise notice 'http: cannot change the grants of % here', f;
    end;
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';

-- ---------- report ----------
select t.check, t.result from (values
  (1, 'anon can read talk_stats of non-public materials (false)',
      (select (count(*) > 0)::text from pg_policies where tablename = 'talk_stats' and qual = 'true')),
  (2, 'comments are rate limited (true)',
      (select (position('PT429' in prosrc) > 0)::text from pg_proc where oid = 'public.comments_stamp()'::regprocedure)),
  (3, 'API can set meeting_requests.created_at (false)',
      has_column_privilege('anon', 'public.meeting_requests', 'created_at', 'insert')::text),
  (4, 'team (not admin) reads team_access (false)',
      (select (count(*) > 0)::text from pg_policies where tablename = 'team_access' and policyname = 'team reads access list')),
  (5, 'anon can call extensions.http_get (false)',
      coalesce((select bool_or(has_function_privilege('anon', p.oid, 'execute'))::text from pg_proc p
                  join pg_namespace n on n.oid = p.pronamespace where p.proname = 'http_get'), 'no http'))
) t(n, "check", result)
order by t.n;
