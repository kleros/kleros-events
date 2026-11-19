-- 0019: view and like counts for talks on YouTube, for "Most watched" on the home and talks pages.
--
-- Free: refresh_talk_stats() reads each video's public YouTube page with the http extension (0007) and
-- takes the view and like counts it shows. No API key, no paid service. A pg_cron job runs it every hour;
-- each run checks up to 40 videos whose counts are more than 20 hours old, so every video is refreshed
-- about once a day and the first full pass finishes within a few hours.
-- X and Google Drive do not show counts to visitors without an account, so only YouTube videos get counts.
--
-- Safe to run more than once.

create extension if not exists http with schema extensions;

create table if not exists talk_stats (
  material_id uuid primary key references materials(id) on delete cascade,
  youtube_id text not null,
  views bigint,
  likes bigint,
  checked_at timestamptz not null default now(),
  -- why the last check found no counts (null when it worked)
  problem text
);
alter table talk_stats enable row level security;
drop policy if exists "talk stats are public" on talk_stats;
-- Stats follow their talk: a private or draft recording's YouTube id stays hidden (security audit 2026-11-19).
create policy "talk stats are public" on talk_stats for select using (material_visible(material_id));
grant select on talk_stats to anon, authenticated;

create table if not exists talk_stats_log (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  checked int not null default 0,
  updated int not null default 0,
  failed int not null default 0
);
alter table talk_stats_log enable row level security;
drop policy if exists "team reads the stats log" on talk_stats_log;
create policy "team reads the stats log" on talk_stats_log for select using (is_team());
grant select on talk_stats_log to authenticated;

-- The 11-character YouTube id of a watch, short, embed, live or shorts link, or null.
create or replace function youtube_id(p_url text) returns text
language sql immutable as $$
  select (regexp_match(p_url, '^https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|live/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})'))[1]
$$;

-- One video's counts from its public page: {"views": n, "likes": n} or {"problem": "..."}.
create or replace function youtube_counts(p_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r extensions.http_response;
  v text; l text;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '15');
  -- the consent cookies skip the EU cookie page, which has no counts on it
  r := extensions.http((
    'GET', 'https://www.youtube.com/watch?v=' || p_id || '&hl=en',
    array[extensions.http_header('Cookie', 'SOCS=CAI; CONSENT=YES+'),
          extensions.http_header('Accept-Language', 'en'),
          extensions.http_header('User-Agent', 'Mozilla/5.0 (compatible; KlerosEvents/1.0; +https://events.kleros.io)')],
    null, null)::extensions.http_request);
  if r.status <> 200 then return jsonb_build_object('problem', 'YouTube answered ' || r.status); end if;
  v := (regexp_match(r.content, '"viewCount":"(\d+)"'))[1];
  l := (regexp_match(r.content, '"likeCount":"?(\d+)'))[1];
  if v is null then
    return jsonb_build_object('problem', case when r.content ~ 'consent\.youtube\.com' then 'cookie page' else 'no count on the page' end);
  end if;
  return jsonb_build_object('views', v::bigint, 'likes', l::bigint);
exception when others then
  return jsonb_build_object('problem', left(sqlerrm, 200));
end $$;

-- Refreshes the counts of up to p_limit YouTube talks whose counts are missing or older than 20 hours.
create or replace function refresh_talk_stats(p_limit int default 40) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  m record; c jsonb;
  n_checked int := 0; n_updated int := 0; n_failed int := 0;
begin
  for m in
    select x.id, youtube_id(x.url) as yid
      from materials x left join talk_stats s on s.material_id = x.id
     where x.kind in ('talk', 'video', 'audio') and youtube_id(x.url) is not null
       and (s.material_id is null or s.checked_at < now() - interval '20 hours' or s.youtube_id <> youtube_id(x.url))
     order by s.checked_at nulls first
     limit p_limit
  loop
    c := youtube_counts(m.yid);
    n_checked := n_checked + 1;
    if c ? 'views' then
      n_updated := n_updated + 1;
      insert into talk_stats (material_id, youtube_id, views, likes, checked_at, problem)
      values (m.id, m.yid, (c->>'views')::bigint, (c->>'likes')::bigint, now(), null)
      on conflict (material_id) do update set youtube_id = excluded.youtube_id, views = excluded.views,
        likes = coalesce(excluded.likes, talk_stats.likes), checked_at = now(), problem = null;
    else
      n_failed := n_failed + 1;
      -- keep the last good counts; note the problem so a later look can tell what went wrong
      insert into talk_stats (material_id, youtube_id, checked_at, problem)
      values (m.id, m.yid, now(), c->>'problem')
      on conflict (material_id) do update set youtube_id = excluded.youtube_id, checked_at = now(), problem = excluded.problem;
    end if;
  end loop;
  insert into talk_stats_log (checked, updated, failed) values (n_checked, n_updated, n_failed);
  return jsonb_build_object('checked', n_checked, 'updated', n_updated, 'failed', n_failed);
end $$;

revoke all on function youtube_counts(text) from public, anon, authenticated;
revoke all on function refresh_talk_stats(int) from public, anon, authenticated;

-- every hour at :41, away from the Luma sync at :07
do $$ begin
  perform cron.unschedule('talk-stats') where exists (select 1 from cron.job where jobname = 'talk-stats');
  perform cron.schedule('talk-stats', '41 * * * *', 'select public.refresh_talk_stats()');
end $$;

-- a first small pass now, so the counts start to appear straight away
select refresh_talk_stats(8);
