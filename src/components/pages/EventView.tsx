import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Material } from "@/lib/types";
import { getEvent, listEvents, listMaterials, type As } from "@/lib/data";
import Related from "@/components/Related";
import { eventProfile, related } from "@/lib/related";
import { cleanDescription, excerpt, fmtRange, googleCalendarUrl, isLive, isPast, place, plural, safeHref } from "@/lib/format";
import { KLEROS_ABOUT, ROLE_LABEL, SITE_URL, productsFor } from "@/lib/kleros";
import { EventCover } from "@/components/EventCard";
import { LinkList, MATERIAL_GROUPS, PhotoGrid, TalkCard, byTalkRank, isTalkLike, linkUrl, sourceOf, talkRank } from "@/components/MaterialRow";
import Ext from "@/components/Ext";
import SpeakerNames from "@/components/SpeakerNames";
import { peopleIn } from "@/lib/people";
import Linkify from "@/components/Linkify";
import CalendarButtons from "@/components/CalendarButtons";
import AskTheSpeaker from "@/components/AskTheSpeaker";
import MeetingForm from "@/components/MeetingForm";
import ManageMenu from "@/components/ManageMenu";
import { currentUser } from "@/lib/supabase/server";

// the visitor copy is built for nobody in particular
const NOBODY = { user: null, profile: null } as const;
import EventStudio from "@/components/studio/EventStudio";
import StudioButton from "@/components/studio/StudioButton";

// a photo that is stored here shows as a tile; a photo that only has a link stays in the list
const isStoredPhoto = (m: Material) => m.kind === "image" && !!m.file_path;

/**
 * An event page. Signed-out visitors get the "public" one: read as a visitor and built ahead, so it is ready at
 * once (app/events/[slug]). Anyone with a session gets it built for them, with their own access (private events,
 * team tools): the middleware sends them to app/session/events/[slug].
 */
export async function eventMetadata(slug: string, as: As): Promise<Metadata> {
  const data = await getEvent(slug, as);
  // a signed-out visitor gets a sign-in page here rather than a 404, which search engines must not keep
  if (!data) return { title: "Event not available", robots: { index: false } };
  const e = data.event;
  const description = `${ROLE_LABEL[e.kleros_role]} · ${fmtRange(e.starts_on, e.ends_on)} · ${place(e)}. ${excerpt(e)}`.slice(0, 200);
  // og:image is ./opengraph-image.tsx, which Next adds by itself and copies to twitter:image; the layout's twitter
  // card is summary_large_image. This openGraph replaces the layout's, so it repeats the site name.
  return {
    title: e.title,
    description,
    alternates: { canonical: `/events/${e.slug}` },
    openGraph: { title: e.title, description, type: "website", siteName: "Kleros Events", url: `/events/${e.slug}`,
      // the share picture lives next to the visitor page (app/events/[slug]); the session copy names it
      ...(as === "session" ? { images: [{ url: `/events/${e.slug}/opengraph-image`, width: 1200, height: 630 }] } : {}) },
    ...(as === "session" ? { twitter: { card: "summary_large_image", site: "@kleros_io", images: [`/events/${e.slug}/opengraph-image`] } } : {}),
  };
}

export default async function EventView({ slug, as }: { slug: string; as: As }) {
  // everything at once: the event itself, who is looking (the team, or a private event's guests), and the public
  // lists for "You might also like" (kept for a minute on the server, so usually no trip to the database)
  const [data, { user, profile }, allEvents, allMaterials] = await Promise.all([
    getEvent(slug, as), as === "public" ? NOBODY : currentUser(), listEvents("public"), listMaterials("public"),
  ]);
  if (!data) {
    // a private event is only readable once signed in with a Kleros team account or an invited email; the same page shows for
    // every unknown address, so it says nothing about whether this one exists
    if (!user) return (
      <div className="wrap page con-gate">
        <div className="eyebrow">Event</div>
        <h1>This event is not available</h1>
        <p className="muted">The link may be old or mistyped. If this is an internal Kleros event, sign in with your Kleros email. If someone added you as a guest, sign in with the email address they used.</p>
        <div className="row-flex">
          <Link className="btn primary" href="/events">All events</Link>
          <Link className="btn" href={`/login?next=${encodeURIComponent(`/events/${slug}`)}`}>Sign in</Link>
        </div>
      </div>
    );
    notFound();
  }
  const { event: e, agenda, team, materials } = data;
  const past = isPast(e);
  const isTeam = !!profile?.is_team;
  // a private event only reaches this page for the team and its invited guests, who may edit it
  const canEdit = isTeam || (!!user && e.visibility === "private");
  // talks with slides, videos, and recordings (audio files) are all listed under Talks:
  // full talks first, then clips, then previews and other videos with no speaker
  const talks = materials.filter(isTalkLike).sort(byTalkRank);
  const full = talks.filter((m) => talkRank(m) === 0);
  const extra = talks.filter((m) => talkRank(m) !== 0);
  // after the event, the newest posts (wrap-ups, recaps) come first in each group
  const groups = MATERIAL_GROUPS.map((g) => {
    const items = materials.filter((m) => g.kinds.includes(m.kind) && !isTalkLike(m));
    return { ...g, items: past ? items.reverse() : items };
  }).filter((g) => g.items.length);
  // name the section after what it holds: no "Slides" heading over a list of posts
  const has = (label: string) => groups.some((g) => g.label === label);
  const matLabel = has("Slides") ? "Slides and links" : has("Photos") ? "Photos and posts" : has("Audio") || has("Documents") ? "Files and links" : "Links and posts";
  // recordings saved without slides, for "Attach slides to a recording"
  const bareRecordings = materials.filter((m) => m.kind === "audio" && !!m.file_path);
  const products = productsFor(e.topics);
  const booker = team.map((t) => t.team_members).find((m) => m?.calendar_url);
  const time = e.start_time ? `${e.start_time.slice(0, 5)}${e.timezone ? ` ${e.timezone}` : ""}` : "";
  const where = [e.venue, place(e)].filter(Boolean).join(", ");
  // after the event, the date, time and ticket lines of a Luma description no longer help
  const description = past ? cleanDescription(e.description) : e.description;
  const hasAbout = !!(description || e.recap);
  // one wording for every event; "(free)" when the team marked it free (0017 is_free)
  const ticketLabel = e.is_free ? "Get tickets (free)" : "Get tickets";
  // You might also like: talks from other events, events and Kleros reading on the same subject (lib/related.ts).
  // An internal meeting's page gets none.
  const pub = e.visibility !== "private";
  const alsoLike = pub
    ? related([{ id: e.id, label: e.title, profile: eventProfile(e) }], allEvents, allMaterials,
      { exclude: new Set([e.id, ...materials.map((m) => m.id)]), talks: 3, events: 3, reads: 4 })
    : { talks: [], events: [], reads: [] };

  // one quiet line: whether it is on now, Kleros's part and the format.
  // Draft and Private are said in the note under the buttons instead.
  const statusWord = isLive(e) ? <span className="st live">Happening now</span> : e.is_example ? <span className="st ex">Example</span> : null;
  // before the event its link is the ticket button; after it, the official site
  const site = past && linkUrl(e.url) ? <a className="text-link" href={linkUrl(e.url)} target="_blank" rel="noopener">{sourceOf(e.url) || "Official site"}<Ext /></a> : null;
  const organiser = e.organizer || site ? (
    <p className="organiser">{e.organizer && <>Organised by {e.organizer}</>}{e.organizer && site && " · "}{site}</p>
  ) : null;
  const talkGrid = (list: Material[], cls: string) => (
    <div className={cls}>{list.map((m) => <TalkCard key={m.id} m={m} event={e} showEvent={false} />)}</div>
  );

  return (
    <>
    <div className="wrap"><Link className="back ev-back" href="/events">← All events</Link></div>
    <header className="wrap ev-head">
      <div className="ev-title">
        <h1>{e.title}</h1>
        <div className="when-where">
          <span>{fmtRange(e.starts_on, e.ends_on, { weekday: true })}{time && ` · ${time}`}</span>
          {where && <span>{where}</span>}
        </div>
        <p className="role-line">{statusWord && <>{statusWord} · </>}{ROLE_LABEL[e.kleros_role]} · {e.event_type}</p>
        {!hasAbout && organiser}
        <div className="ev-actions">
          {past && talks.length > 0 && <a className="btn primary" href="#talks">Watch {plural(talks.length, "talk")}</a>}
          {linkUrl(e.url) && !past && <a className="btn primary" href={linkUrl(e.url)} target="_blank" rel="noopener">{ticketLabel}<Ext /></a>}
          {!past && <CalendarButtons slug={e.slug} calendarUrl={googleCalendarUrl(e, `${SITE_URL}/events/${e.slug}`)} />}
          {canEdit && <ManageMenu slug={e.slug} eventId={e.id} isTeam={isTeam} hasBareRecordings={bareRecordings.length > 0} />}
        </div>
        {e.visibility === "private"
          ? <div className="note">Private. Internal to the Kleros team: only team members and the guests added to it can see this event, its materials and its questions.</div>
          : e.status === "draft" && <div className="note">Draft. Only the Kleros team can see this event until it is published.</div>}
      </div>
      <EventCover e={e} className="ev-cover" />
    </header>

    <div className="wrap sections">
      {hasAbout && (
        <section id="about" className="sec">
          <h2>About</h2>
          {e.recap && (
            <div className="ev-recap">
              <h3 className="sub-h">Recap</h3>
              <p className="desc"><Linkify text={e.recap} /></p>
            </div>
          )}
          {description && <p className="desc"><Linkify text={description} /></p>}
          {organiser}
        </section>
      )}

      {(talks.length > 0 || canEdit) && (
        <section id="talks" className="sec">
          <h2>Talks</h2>
          {/* opened from the Manage menu; it scrolls itself into view */}
          {canEdit && <EventStudio event={{ id: e.id, slug: e.slug, title: e.title }} agenda={agenda} recordings={bareRecordings} isTeam={isTeam} />}
          {full.length > 0 && talkGrid(full, "grid")}
          {extra.length > 0 && (full.length > 0 ? (
            <details className="fold">
              <summary>Clips and short videos ({extra.length})</summary>
              {talkGrid(extra, "grid four")}
            </details>
          ) : talkGrid(extra, "grid four"))}
          {!talks.length && (
            <p className="quiet-empty">No talks yet. <StudioButton mode="record" className="link-btn">Record a session</StudioButton></p>
          )}
        </section>
      )}

      {groups.length > 0 && (
        <section id="materials" className="sec">
          <h2>{matLabel}</h2>
          {groups.map((g) => (
            <div key={g.label} className="mat-group">
              {groups.length > 1 && <h3 className="sub-h">{g.label}</h3>}
              {g.label === "Photos" ? (
                <>
                  <PhotoGrid items={g.items.filter(isStoredPhoto)} />
                  <LinkList items={g.items.filter((m) => !isStoredPhoto(m))} />
                </>
              ) : <LinkList items={g.items} />}
            </div>
          ))}
        </section>
      )}

      {agenda.length > 0 && (
        <section id="agenda" className="sec">
          <h2>Agenda</h2>
          <div className="agenda">
            {agenda.map((a) => (
              <div key={a.id} className="ag">
                <span className="tm">{a.starts_at?.slice(0, 5)}</span>
                <div>
                  <div className={a.is_kleros ? "k" : ""} style={{ fontWeight: 600 }}>{a.title}{a.is_kleros && " · Kleros"}</div>
                  {a.speaker && <div className="muted small"><SpeakerNames speaker={a.speaker} /></div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {team.length > 0 && (
        <section id="team" className="sec">
          <h2>Kleros team</h2>
          <p className="muted small">{past ? "Who was there for Kleros." : "Who will be there for Kleros."}</p>
          <div className="team">
            {team.filter((t) => t.team_members).map(({ team_members: m, part }) => {
              const handle = m.x_handle?.replace(/^@/, "");
              const profile = peopleIn(m.name)[0];
              return (
                <div key={m.id} className="person">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <span className="av">{m.avatar_url ? <img src={linkUrl(m.avatar_url)} alt="" /> : m.name[0]}</span>
                  <span className="who">
                    <b>{profile ? <Link href={`/people/${profile.slug}`}>{m.name}</Link> : m.name}</b>
                    {(part || m.title) && <span className="muted">{part || m.title}</span>}
                    {handle && <a href={`https://x.com/${handle}`} target="_blank" rel="noopener">@{handle}<Ext /></a>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* "Ask the speaker" only where someone speaks: not on a public event Kleros only attends or has a booth at
          with no talks or agenda yet (the team still sees it, to run questions live) */}
      {(canEdit || talks.length > 0 || agenda.length > 0 || !["attending", "booth"].includes(e.kleros_role)) && (
        <section id="ask" className="sec">
          <h2>{past ? "Questions for the speakers" : "Ask the speaker"}</h2>
          <AskTheSpeaker eventId={e.id} isTeam={canEdit} slug={e.slug} past={past} isPrivate={e.visibility === "private"} />
        </section>
      )}

      <Related data={alsoLike} variant="sec" />

      {/* an internal meeting's page has no sales blocks */}
      {e.visibility !== "private" && (
        <section id="meet" className="sec">
          <h2>Meet Kleros</h2>
          <div className="meet">
            {/* visitors often land here from a QR code or a post, so say what Kleros is */}
            <p>{KLEROS_ABOUT}</p>
            <p>{past
              ? "Missed the team at this one? Send a request anyway. The team follows up on every one."
              : "Book time with the team to talk about integrating Kleros, trust for your AI agents, or partnering."}</p>
            {booker && safeHref(booker.calendar_url) && <a className="btn primary" href={safeHref(booker.calendar_url)} target="_blank" rel="noopener">Pick a time with {booker.name.split(" ")[0]}<Ext /></a>}
            {/* requests are read by the whole team; this section is not shown on a private event's page */}
            <MeetingForm eventId={e.id} />
            {products.length > 0 && (
              <p className="meet-links">
                {products.map((p, i) => (
                  <Fragment key={p.name}>{i > 0 && " · "}<a className="text-link" href={p.url} target="_blank" rel="noopener">{p.name}<Ext /></a></Fragment>
                ))}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
    </>
  );
}
