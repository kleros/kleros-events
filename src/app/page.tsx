import Link from "next/link";
import { listEvents, listMaterials, eventCounts, eventIdsOf, materialCounts } from "@/lib/data";
import { fmtRange, isLive, isPast, latestFirst, plural, place, soonestFirst } from "@/lib/format";
import { LUMA_URL } from "@/lib/kleros";
import EventCard, { EventCover, RolePill, statusLabel } from "@/components/EventCard";
import { TalkCard, isClip, isWatchable, talkRank, videoThumb } from "@/components/MaterialRow";
import PromoStrip from "@/components/PromoStrip";
import SetupNotice from "@/components/SetupNotice";

export const revalidate = 60;

export default async function Home() {
  const [events, materials, counts] = await Promise.all([listEvents(), listMaterials(), eventCounts()]);
  const upcoming = events.filter((e) => !isPast(e)).sort(soonestFirst);
  const next = upcoming[0];
  const later = upcoming.slice(1, 4);
  const perEvent = materialCounts(materials, isWatchable);
  const talkCount = (id: string) => perEvent.talks[id] ?? 0;
  const itemCount = (id: string) => perEvent.items[id] ?? 0;
  // most recently ended first, and on the same day the event with more talks
  const past = events.filter(isPast).sort((a, b) => latestFirst(a, b) || talkCount(b.id) - talkCount(a.id));
  const recent = past.slice(0, 3);
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));
  // Talks from events the visitor can see, latest event first.
  // A talk linked to several events shows with the latest one the visitor can see.
  const shownWith = (m: (typeof materials)[number]) => eventIdsOf(m).map((id) => byId[id]).filter(Boolean).sort(latestFirst)[0];
  const talks = materials.filter((m) => isWatchable(m) && shownWith(m));
  // The home row: full talks only (no clips), one per event, the ones with a real picture first.
  const seen = new Set<string>();
  const latestTalks = talks.filter((m) => !isClip(m) && talkRank(m) === 0)
    .sort((a, b) => latestFirst(shownWith(a), shownWith(b)) || Number(!videoThumb(a)) - Number(!videoThumb(b)) || b.created_at.localeCompare(a.created_at))
    .filter((m) => { const id = shownWith(m).id; if (seen.has(id)) return false; seen.add(id); return true; })
    .slice(0, 3);
  const cities = new Set(events.filter((e) => e.city).map((e) => e.city)).size;
  // With nothing coming up, the hero shows the latest event that has talks to watch.
  const featured = next ?? past.find((e) => talkCount(e.id) > 0) ?? past[0];
  const featuredStatus = featured && statusLabel(featured);

  return (
    <>
      <div className="hero-band">
        <div className="wrap hero">
          <div className="hero-copy">
            <SetupNotice />
            <div className="eyebrow">Kleros on stage and on the road</div>
            <h1 className="hero-title">Where Kleros shows up, <em>and what was said there.</em></h1>
            <p className="lede">The events Kleros hosts, sponsors and speaks at. Find the next one, rewatch past talks with their slides, ask the speakers questions and meet the team.</p>
            <div className="row-flex actions">
              {next ? (
                <>
                  <a className="btn cta" href={LUMA_URL} target="_blank" rel="noopener">Follow Kleros on Luma ↗</a>
                  <Link className="btn" href="/talks">Watch the talks</Link>
                </>
              ) : (
                <>
                  <Link className="btn cta" href="/talks">Watch the talks</Link>
                  <a className="btn" href={LUMA_URL} target="_blank" rel="noopener">Get new events on Luma ↗</a>
                </>
              )}
            </div>
            {events.length > 0 && (
              <dl className="stats">
                {upcoming.length > 0 && <div className="stat"><dt>upcoming</dt><dd>{upcoming.length}</dd></div>}
                <div className="stat"><dt>events on record</dt><dd>{events.length}</dd></div>
                <div className="stat"><dt>recorded talks</dt><dd>{talks.length}</dd></div>
                {cities > 0 && <div className="stat"><dt>cities</dt><dd>{cities}</dd></div>}
              </dl>
            )}
          </div>
          {featured && (
            <Link className="feature" href={`/events/${featured.slug}`}>
              <EventCover e={featured} />
              <span className="feature-body">
                <span className="eyebrow accent">{isLive(featured) ? "Happening now" : next ? "Next up" : "Latest event"}</span>
                <h2>{featured.title}</h2>
                <span className="when">{fmtRange(featured.starts_on, featured.ends_on)}{next && featured.start_time ? ` · ${featured.start_time.slice(0, 5)}` : ""} · {place(featured)}</span>
                <span className="meta">
                  <RolePill e={featured} />
                  <span className="pill plain">{featured.event_type}</span>
                  {featuredStatus && featuredStatus.cls !== "live" && <span className={`pill ${featuredStatus.cls}`}>{featuredStatus.text}</span>}
                </span>
                <span className="feature-go">{!next && talkCount(featured.id) ? `Watch ${plural(talkCount(featured.id), "talk")} →` : "See the event →"}</span>
              </span>
            </Link>
          )}
        </div>
      </div>

      <div className="wrap">
        <PromoStrip />

        {later.length > 0 && (
          <section className="block">
            <div className="section-h"><h2>Coming up</h2><Link href="/events?when=upcoming">All upcoming →</Link></div>
            <div className="grid">{later.map((e) => <EventCard key={e.id} e={e} talks={talkCount(e.id)} materials={itemCount(e.id)} going={counts[e.id]?.going} />)}</div>
          </section>
        )}
        <section className="block">
          <div className="section-h"><h2>Latest talks</h2>{talks.length > 0 && <Link href="/talks">All {plural(talks.length, "talk")} →</Link>}</div>
          {latestTalks.length
            ? <div className="grid">{latestTalks.map((m) => <TalkCard key={m.id} m={m} event={shownWith(m)} />)}</div>
            : <p className="quiet-empty">Talks appear here with their slides once the team uploads them after an event.</p>}
        </section>

        {recent.length > 0 && (
          <section className="block">
            <div className="section-h"><h2>Recently</h2><Link href="/events?when=past">All past events →</Link></div>
            <div className="grid">{recent.map((e) => <EventCard key={e.id} e={e} talks={talkCount(e.id)} materials={itemCount(e.id)} />)}</div>
          </section>
        )}

        {!upcoming.length && (
          <p className="quiet-empty center">No upcoming events announced yet. New ones are posted on <a href={LUMA_URL} target="_blank" rel="noopener">Luma</a> first.</p>
        )}
      </div>
    </>
  );
}
