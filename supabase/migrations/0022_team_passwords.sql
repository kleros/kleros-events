-- 0022: passwords only on confirmed accounts (team sign-in with a password, 25 Nov 2026).
--
-- 0014 emptied every stored password, so the only way in was an email link. The reason still holds:
-- anyone with the public key can call /auth/v1/signup with a password for an address that has no
-- account yet, and if the owner later confirmed that account with an email link, the stranger's
-- password would let them in (team access for an @kleros.io address).
--
-- The admin now adds teammates by hand, already confirmed, with a password (no email is sent). So:
--   * a password is kept only on an account whose email is confirmed;
--   * an unconfirmed account (every self sign-up, and anonymous QR guests) never keeps one;
--   * when an account becomes confirmed, a password it already had is emptied: that is the
--     password someone set before the owner proved the address. Only a password written in the
--     same step as the confirmation (the admin's SQL scripts) is kept. The dashboard's Add user may
--     create the account first and confirm it after, which drops its password: after a dashboard add,
--     set the password with the SQL (team-accounts/new-password-for-one-person.sql).
-- A confirmed user changing their own password (My events) keeps working.
-- Confirm email must stay ON (Authentication > Sign In / Providers > Email). Re-runnable.

create or replace function public.clear_auth_password() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.encrypted_password is null or new.encrypted_password = '' then
    return new;
  end if;
  if new.email_confirmed_at is null then
    -- self sign-ups, unconfirmed addresses and anonymous guests: never a password
    new.encrypted_password := '';
  elsif tg_op = 'UPDATE' and old.email_confirmed_at is null
        and new.encrypted_password is not distinct from old.encrypted_password then
    -- just confirmed, carrying a password set before the address was proven: drop it
    new.encrypted_password := '';
  end if;
  return new;
end $$;
revoke all on function public.clear_auth_password() from public, anon, authenticated;

drop trigger if exists clear_auth_password on auth.users;
create trigger clear_auth_password
  before insert or update on auth.users
  for each row
  execute function public.clear_auth_password();

-- Unconfirmed accounts that hold a password now (none expected after 0014) lose it.
update auth.users set encrypted_password = ''
 where email_confirmed_at is null and coalesce(encrypted_password, '') <> '';

-- The public site has no visitor accounts since 25 Nov (commit 0547783): saves, attendance, comments
-- and watch progress are no longer used anywhere. Anonymous QR sessions still count as "authenticated",
-- so close these tables to the public API (nothing is deleted; the SQL editor still reads them).
do $$
declare t text;
begin
  foreach t in array array['comments', 'event_saves', 'material_saves', 'attendance', 'talk_progress'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke select, insert, update, delete on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Report: confirmed accounts with a password (expected: 0 until the admin sets some).
select count(*) filter (where coalesce(encrypted_password, '') <> '') as accounts_with_password,
       count(*) filter (where email_confirmed_at is null and coalesce(encrypted_password, '') <> '') as unconfirmed_with_password_should_be_0
  from auth.users;
