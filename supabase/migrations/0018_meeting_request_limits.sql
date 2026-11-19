-- Limits on meeting and partnership requests (19 November 2026).
--
-- Anyone can send a request (0001), so the form on a profile page could be used for spam. This
-- adds sensible limits in the database itself, where a script posting straight to the API cannot
-- get around them:
--   - name, email and company up to 200 characters, message up to 4000, interest up to 100;
--   - at most 3 requests from the same email address in an hour;
--   - at most 40 requests from everyone together in 10 minutes (a flood stops, normal use never
--     comes close).
-- Requests already stored are not touched. Safe to run more than once.

create or replace function meeting_request_limits() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(new.name, '')) > 200 or length(coalesce(new.email, '')) > 200
     or length(coalesce(new.company, '')) > 200 or length(coalesce(new.interest, '')) > 100
     or length(coalesce(new.message, '')) > 4000 then
    raise exception 'The request is too long.' using errcode = '22001';
  end if;
  if new.email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please check the email address.' using errcode = '22023';
  end if;
  if (select count(*) from meeting_requests
      where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many requests from this email. Please try again later.' using errcode = 'PT429';
  end if;
  if (select count(*) from meeting_requests where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Too many requests right now. Please try again later.' using errcode = 'PT429';
  end if;
  return new;
end $$;

drop trigger if exists meeting_request_limits on meeting_requests;
create trigger meeting_request_limits before insert on meeting_requests
  for each row execute function meeting_request_limits();

create index if not exists meeting_requests_email_time on meeting_requests (lower(email), created_at);
