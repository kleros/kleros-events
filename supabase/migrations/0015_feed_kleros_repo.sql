-- The socials feed is read from the Kleros GitHub organization as well (18 November 2026).
--
-- The code now lives in kleros/kleros-events (a fork of weiwei-ooi/kleros-events), and the Netlify
-- site builds from it. Changes can land in either copy before the other is synced, so feed_get()
-- reads the feed file from both copies on GitHub and joins their items. An item that is in both
-- is taken from the Kleros copy. https://events.kleros.io is read only when neither GitHub copy
-- answers, as before (0014).
--
-- Each address gets at most 2 seconds, so Sync now on /admin (8 second limit for signed-in users)
-- still answers when all three are tried. Safe to run more than once. Changes nothing else:
-- sync_feed() and the link rules from 0014 stay as they are.
--
-- Once weiwei-ooi/kleros-events is no longer kept in sync, or before that account is renamed or
-- deleted, remove its address here with a new migration.

create or replace function feed_get() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r extensions.http_response;
  v_url text;
  v_feed jsonb;
  v_items jsonb := '[]'::jsonb;
  v_ids text[] := '{}';
  v_found boolean := false;
  it jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '2');
  foreach v_url in array array[
    'https://raw.githubusercontent.com/kleros/kleros-events/main/public/updates/feed.json',
    'https://raw.githubusercontent.com/weiwei-ooi/kleros-events/main/public/updates/feed.json'
  ] loop
    begin
      r := extensions.http_get(v_url || '?t=' || extract(epoch from now())::bigint);
      if r.status = 200 then
        v_feed := r.content::jsonb;
        if jsonb_typeof(v_feed) = 'object' and jsonb_typeof(v_feed -> 'items') = 'array' then
          v_found := true;
          for it in select * from jsonb_array_elements(v_feed -> 'items') loop
            if jsonb_typeof(it) = 'object' and coalesce(it ->> 'id', '') <> ''
               and not (it ->> 'id' = any(v_ids)) then
              v_ids := v_ids || (it ->> 'id');
              v_items := v_items || jsonb_build_array(it);
            end if;
          end loop;
        end if;
      end if;
    exception when others then
      null;  -- not reachable or not JSON: try the next address
    end;
  end loop;
  if v_found then
    return jsonb_build_object('items', v_items);
  end if;

  begin
    r := extensions.http_get('https://events.kleros.io/updates/feed.json?t=' || extract(epoch from now())::bigint);
    if r.status = 200 then
      v_feed := r.content::jsonb;
      if jsonb_typeof(v_feed) = 'object' and jsonb_typeof(v_feed -> 'items') = 'array' then
        return v_feed;
      end if;
    end if;
  exception when others then
    null;
  end;
  return null;
end $$;
revoke all on function feed_get() from public, anon, authenticated;

select 'feed_get now reads kleros/kleros-events and weiwei-ooi/kleros-events' as done;
