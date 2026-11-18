# Deploying on Netlify

The site runs on Netlify with no code changes. `netlify.toml` holds the build settings, and Netlify adds its Next.js adapter (OpenNext) on its own. A local `netlify build` of this repo (Netlify CLI 27.14) completes, with the middleware bundled as an edge function.

The Vercel deployment can keep running alongside. Both read the same Supabase database, so either one can be switched off later without losing anything. When Vercel is switched off, keep the Vercel project rather than deleting it: share links and QR codes made on Vercel point at `kleros-events.vercel.app`, and the name of a deleted project can be taken by someone else.

## 1. Create the site

1. Log in to Netlify (the repository owner, `weiwei-ooi`, can log in with Google or GitHub).
2. Go to **Add new project → Import an existing project → GitHub**. GitHub asks once to let Netlify read the repository: choose `weiwei-ooi`, then **Only select repositories**, then `kleros-events`, and approve.
3. Pick `weiwei-ooi/kleros-events`, branch `main`, and deploy. Leave the build settings empty: they come from `netlify.toml` (`npm run build`, publish `.next`, Node 22).

From then on every commit to `main` deploys on its own. Events, talks and materials need no deploy at all: they live in the database, so the site shows them as soon as they are added.

Importing a fork instead (for example into the Kleros GitHub organization) also works, but then new changes only reach the site when someone presses **Sync fork** on GitHub. The site at events.kleros.io was built that way on 29 Oct 2026 and stayed on that copy, so prefer importing the original.

## 2. Environment variables

The database address and its public key are already in `netlify.toml`, so a new site shows the real events with no settings. Values in `netlify.toml` win over values typed in the Netlify UI, so a UI value cannot point the site at another database by mistake. To move to another database, change `netlify.toml`.

The rest are optional. Set them under **Project configuration → Environment variables**, and mark the keys as secret.

| Variable | Needed | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | no | Leave unset. Netlify's main site address is used for share links, QR codes and calendar files, and that becomes `https://events.kleros.io` once the domain is set as primary. |
| `GROQ_API_KEY` | no | Turns on transcripts of recordings. Mark it as secret. |
| `ANTHROPIC_API_KEY` | no | Turns on talk summaries and the site assistant (the Ask button). Mark it as secret. Give the key's Anthropic workspace a monthly spend limit (see the README under "Site assistant", with the other `ASK_*` settings). |
| `SUPABASE_SERVICE_ROLE_KEY` | for the assistant outside the team | Required, with migration `0014_security.sql` run in Supabase, before visitors and accounts outside the team can use the assistant: it keeps their question limits in the database. Without it only the team sees the Ask button. It also lets a failed transcript run always record its error. Mark it as secret. |

Changing a variable needs a new deploy before it takes effect (**Deploys → Trigger deploy**).

## 3. Domain

1. If `events.kleros.io` is still attached to another Netlify site, remove it there first (that site's **Domain management → Options → Remove domain**). Netlify lets only one site hold a domain.
2. In **Domain management**, add `events.kleros.io` and set it as the primary domain.
3. In Cloudflare, point the `CNAME` record for `events` at the new site's Netlify address, for example `kleros-events.netlify.app`. Set it to **DNS only** (grey cloud).
4. Run one more deploy, so that share links and QR codes pick up the domain.

If the Netlify site is ever deleted, remove the `events` record in Cloudflare at the same time. A record left pointing at a deleted site lets someone else take over the address, and the hourly feed sync reads `events.kleros.io` when GitHub does not answer.

## 4. Sign-in

Supabase only sends people back to addresses on its allow list.

- `https://events.kleros.io/**` is already on that list, so sign-in works on the domain without further changes.
- To sign in on the `*.netlify.app` address as well, add `https://<site-name>.netlify.app/**` under **Supabase → Authentication → URL configuration → Redirect URLs**. Add only the exact site name, never a `*.netlify.app` wildcard: a wildcard would let any Netlify site receive sign-in links.
- Deploy previews cannot sign in. Pages that need no sign-in work as usual.
- **Confirm email** must stay on (Supabase → Authentication → Sign In / Providers, the Confirm email switch). Netlify and Vercel use the same Supabase project, so this one setting covers both. With it off, anyone could sign up with an `@kleros.io` address and get team access. Details are in the README, under Setup, step 3.

## What else to know

- **Hourly jobs.** Luma and the socials feed run inside Supabase (pg_cron). They do not depend on the host. The feed is read from the file on the main branch of `weiwei-ooi/kleros-events` on GitHub, and from `https://events.kleros.io/updates/feed.json` only when GitHub does not answer (migration 0014, details in `docs/social-feed.md`). The Vercel address is no longer read. If Netlify builds from a fork, the fork's copy is read only in that fallback, and it can lag behind main until the fork is synced.
- **Time limit.** Netlify ends every server request after 60 seconds, where Vercel allowed this app 300. The transcript route detects Netlify at build time and splits its work so that each step fits: the transcript in one request, the summary in the next. A very long summary on a slow model can still run past 60 seconds. If that happens, set `ANTHROPIC_MODEL` to a faster model.
- **Middleware** (session refresh for Supabase) runs as a Netlify Edge Function. It needs no settings.
- **Images** go through Netlify Image CDN. Supabase storage is already allowed in `next.config.ts`.
