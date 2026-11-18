import Link from "next/link";
import { listEvents, listMaterials, eventCounts, eventIdsOf, materialCounts } from "@/lib/data";
import { fmtRange, isLive, isPast, latestFirst, plural, place, soonestFirst } from "@/lib/format";
import { LUMA_URL } from "@/lib/kleros";
import EventCard, { EventCover, statusLabel } from "@/components/EventCard";
import { TalkCard, isClip, isWatchable, talkRank, videoThumb } from "@/components/MaterialRow";
import SetupNotice from "@/components/SetupNotice";
import Ext from "@/components/Ext";

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
  const featuredLive = !!featured && isLive(featured);
  // the featured event is in the hero already, so it is not repeated under Recently
  const recent = past.filter((e) => e.id !== featured?.id).slice(0, 3);
  const stats = [
    upcoming.length > 0 && plural(upcoming.length, "upcoming", "upcoming"),
    plural(events.length, "event"),
    plural(talks.length, "talk"),
    cities > 0 && plural(cities, "city", "cities"),
  ].filter(Boolean).join(" · ");

  return (
    <>
      <section className="hero-band">
        <div className="wrap hero">
          <div className="hero-copy">
            <SetupNotice />
            <h1 className="hero-title">Where Kleros shows up, <em>and what was said there.</em></h1>
            <p className="lede">The events Kleros hosts, sponsors and speaks at, with the talks from each one.</p>
            <div className="hero-actions">
              <Link className="btn primary" href="/talks">Watch the talks</Link>
              <a className="text-link" href={LUMA_URL} target="_blank" rel="noopener">Upcoming events on Luma<Ext /></a>
            </div>
            {events.length > 0 && <p className="hero-stats">{stats}</p>}
          </div>
          {featured && (
            <Link className="feature" href={`/events/${featured.slug}`}>
              <EventCover e={featured} />
              <span className={`feature-label${featuredLive ? " live" : ""}`}>
                {featuredLive ? "Happening now" : next ? "Next up" : "Latest event"}
                {featuredStatus && featuredStatus.cls !== "live" ? ` · ${featuredStatus.text}` : ""}
              </span>
              {/* the tile shows the name, dates and place; the start time is the one thing it leaves out */}
              <span className="sr-only">{featured.title}, {fmtRange(featured.starts_on, featured.ends_on)}, {place(featured)}</span>
              {next && featured.start_time && <span className="feature-meta">Starts at {featured.start_time.slice(0, 5)}{featured.timezone ? ` ${featured.timezone}` : ""}</span>}
              <span className="feature-go">{!next && talkCount(featured.id) ? `Watch ${plural(talkCount(featured.id), "talk")} →` : "See the event →"}</span>
            </Link>
          )}
        </div>
      </section>

      <div className="wrap">
        {later.length > 0 && (
          <section className="block">
            <div className="section-h"><h2>Coming up</h2><Link href="/events?when=upcoming">All upcoming →</Link></div>
            <div className="grid">{later.map((e) => <EventCard key={e.id} e={e} talks={talkCount(e.id)} materials={itemCount(e.id)} going={counts[e.id]?.going} showExcerpt />)}</div>
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
      </div>
    </>
  );
}
