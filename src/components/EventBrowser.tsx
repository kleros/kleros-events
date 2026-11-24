"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EventRow } from "@/lib/types";
import EventCard from "./EventCard";
import { EVENT_TYPES, LUMA_URL, TOPICS, topicLabel } from "@/lib/kleros";
import { endOf, isPast, latestFirst, matchesWords, plural, soonestFirst, todayIso } from "@/lib/format";

export type When = "all" | "upcoming" | "past";
export type View = "list" | "calendar";
type Counts = { talks: Record<string, number>; materials: Record<string, number>; going: Record<string, number> };

const LUMA_NOTE = <>No upcoming events announced yet. New ones are posted on <a href={LUMA_URL} target="_blank" rel="noopener">Luma</a> first.</>;

export default function EventBrowser({ events, counts, initialWhen = "all", initialView = "list", initialMonth }: {
  events: EventRow[]; counts: Counts; initialWhen?: When; initialView?: View;
  /** "YYYY-MM" computed on the server, so the calendar renders the same month on server and client */
  initialMonth: string;
}) {
  const [when, setWhen] = useState<When>(initialWhen);
  const [view, setView] = useState<View>(initialView);
  const [type, setType] = useState("");
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState("");
  const [rec, setRec] = useState(false);
  // the filters panel starts closed: no filter is set when the page loads
  const [showFilters, setShowFilters] = useState(false);
  const [month, setMonth] = useState(() => { const [y, m] = initialMonth.split("-").map(Number); return new Date(y, m - 1, 1, 12); });

  // The page is the same for everyone (built ahead), so ?when= and ?view= are read here, once,
  // before the address is kept in step with the buttons below.
  const [fromUrl, setFromUrl] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const w = p.get("when"), v = p.get("view");
    if (w === "upcoming" || w === "past") setWhen(w);
    if (v === "calendar") setView("calendar");
    setFromUrl(true);
  }, []);

  // Keep the address shareable without reloading the page.
  useEffect(() => {
    if (!fromUrl) return;
    const u = new URL(window.location.href);
    if (when === "all") u.searchParams.delete("when"); else u.searchParams.set("when", when);
    if (view === "list") u.searchParams.delete("view"); else u.searchParams.set("view", view);
    u.searchParams.delete("role");
    window.history.replaceState(null, "", u.pathname + u.search);
  }, [when, view, fromUrl]);

  const topics = useMemo(() => [...new Set([...TOPICS, ...events.flatMap((e) => e.topics)])].sort(), [events]);
  const types = useMemo(() => [...new Set([...EVENT_TYPES, ...events.map((e) => e.event_type)])], [events]);

  const matching = events.filter((e) => {
    if (type && e.event_type !== type) return false;
    if (topic && !e.topics.includes(topic)) return false;
    if (rec && !counts.talks[e.id]) return false;
    if (q.trim() && !matchesWords([e.title, e.city, e.country, e.venue, e.organizer, e.description, e.event_type, e.topics.join(" ")].join(" "), q)) return false;
    return true;
  });
  const upcoming = matching.filter((e) => !isPast(e)).sort(soonestFirst);
  // most recently ended first; on the same day, the event with more talks
  const past = matching.filter(isPast).sort((a, b) => latestFirst(a, b) || (counts.talks[b.id] ?? 0) - (counts.talks[a.id] ?? 0));
  const filtered = !!(type || topic || q.trim() || rec);
  const activeFilters = [type, topic, rec].filter(Boolean).length;
  const clear = () => { setType(""); setTopic(""); setQ(""); setRec(false); };

  // ?when=upcoming or ?when=past still narrows the list; the calendar always shows every event
  const only = view === "list" && when !== "all" ? when : null;
  const shownCount = view === "calendar" ? matching.length : when === "upcoming" ? upcoming.length : when === "past" ? past.length : matching.length;
  const totalCount = only === "upcoming" ? events.filter((e) => !isPast(e)).length : only === "past" ? events.filter(isPast).length : events.length;
  const noun = only ? `${only} event` : "event";
  const showAll = <button type="button" className="link-btn" onClick={() => setWhen("all")}>Show all events</button>;

  return (
    <div className="ev-browser">
      <div className="ev-tools">
        <input className="search" type="search" placeholder="Search by name, city or topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        <button type="button" className="btn" aria-expanded={showFilters} aria-controls="ev-filters" onClick={() => setShowFilters(!showFilters)}>
          Filters{activeFilters > 0 && <> · {activeFilters}<span className="sr-only"> active</span></>}
        </button>
        <div className="tabs" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
          <button type="button" aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>Calendar</button>
        </div>
      </div>

      {showFilters && (
        <div id="ev-filters" className="ev-filters">
          <select className="f" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
            <option value="">All topics</option>{topics.map((t) => <option key={t} value={t}>{topicLabel(t)}</option>)}
          </select>
          <select className="f" value={type} onChange={(e) => setType(e.target.value)} aria-label="Event type">
            <option value="">All formats</option>{types.map((t) => <option key={t}>{t}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={rec} onChange={(e) => setRec(e.target.checked)} /> With recorded talks</label>
        </div>
      )}

      {/* always in the page, so screen readers hear the count change; text only when it helps */}
      <p className="result-line" role="status">
        {filtered ? (
          <>
            {shownCount} of {plural(totalCount, noun)} {shownCount === 1 ? "matches" : "match"} · <button type="button" className="link-btn" onClick={clear}>Clear filters</button>
            {only && <> · {showAll}</>}
          </>
        ) : only ? (
          <>{only === "upcoming" ? "Upcoming" : "Past"} events only · {showAll}</>
        ) : null}
      </p>

      {!events.length ? (
        <div className="empty"><b>No events on record yet</b>The Kleros team adds events here. Upcoming ones also appear on <a href={LUMA_URL} target="_blank" rel="noopener">Luma</a>.</div>
      ) : view === "calendar" ? (
        <>
          <MonthGrid month={month} setMonth={setMonth} events={matching} />
          <MonthList month={month} events={matching} counts={counts} />
        </>
      ) : (
        <>
          {/* with a filter on and nothing coming up, no empty "Upcoming" section in the full list */}
          {when !== "past" && (upcoming.length > 0 || !filtered || when === "upcoming") && (
            <Timeline title="Upcoming" list={upcoming} counts={counts} empty={filtered ? "No upcoming events match." : LUMA_NOTE} />
          )}
          {when !== "upcoming" && (
            <Timeline list={past} counts={counts} byYear limit={filtered ? undefined : 12}
              empty={filtered ? "No past events match." : "No past events on record yet."} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * A list of event cards. `title` heads it; `byYear` puts a year heading before each year's cards;
 * `limit` shows that many cards first, with a button for the rest (searching or filtering shows all).
 */
function Timeline({ title, list, counts, empty, byYear = false, limit }: {
  title?: string; list: EventRow[]; counts: Counts; empty: React.ReactNode; byYear?: boolean; limit?: number;
}) {
  const [all, setAll] = useState(false);
  const shown = limit && !all ? list.slice(0, limit) : list;
  const card = (e: EventRow) => <EventCard key={e.id} e={e} talks={counts.talks[e.id]} materials={counts.materials[e.id]} going={isPast(e) ? 0 : counts.going[e.id]} />;
  const years = byYear ? [...new Set(shown.map((e) => e.starts_on.slice(0, 4)))] : [];
  return (
    <section className="timeline">
      {title && <h2 className="tl-h">{title}</h2>}
      {!list.length ? <p className="quiet-empty">{empty}</p>
        : byYear ? years.map((y) => (
          <div key={y} className="year">
            <h2 className="year-h">{y}</h2>
            <div className="grid">{shown.filter((e) => e.starts_on.startsWith(y)).map(card)}</div>
          </div>
        ))
        : <div className="grid">{shown.map(card)}</div>}
      {shown.length < list.length && (
        <button type="button" className="btn more" onClick={() => setAll(true)}>Show all {plural(list.length, byYear ? "past event" : "event")}</button>
      )}
    </section>
  );
}

function inMonth(e: EventRow, month: Date) {
  const y = month.getFullYear(), m = String(month.getMonth() + 1).padStart(2, "0");
  const first = `${y}-${m}-01`, last = `${y}-${m}-31`;
  return e.starts_on <= last && endOf(e) >= first;
}

function MonthList({ month, events, counts }: { month: Date; events: EventRow[]; counts: Counts }) {
  const list = events.filter((e) => inMonth(e, month)).sort(soonestFirst);
  const label = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return (
    <section className="timeline">
      <h3 className="sub-h">{list.length ? `${plural(list.length, "event")} in ${label}` : `Nothing on record for ${label}`}</h3>
      {list.length > 0 && (
        <div className="grid">
          {list.map((e) => <EventCard key={e.id} e={e} talks={counts.talks[e.id]} materials={counts.materials[e.id]} going={isPast(e) ? 0 : counts.going[e.id]} />)}
        </div>
      )}
    </section>
  );
}

function MonthGrid({ month, setMonth, events }: { month: Date; setMonth: (d: Date) => void; events: EventRow[] }) {
  const y = month.getFullYear(), mo = month.getMonth();
  const first = new Date(y, mo, 1, 12);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); if (i >= 35 && d.getMonth() !== mo) break; days.push(d); }
  const today = todayIso();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return (
    <div className="month">
      <div className="month-nav">
        <button className="btn sm ghost" onClick={() => setMonth(new Date(y, mo - 1, 1, 12))} aria-label="Previous month">‹</button>
        <h2>{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
        <button className="btn sm ghost" onClick={() => setMonth(new Date(y, mo + 1, 1, 12))} aria-label="Next month">›</button>
      </div>
      <div className="cal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="dow">{d}</div>)}
        {days.map((d) => {
          const k = iso(d);
          const evs = events.filter((e) => e.starts_on <= k && endOf(e) >= k);
          return (
            <div key={k} className={`day ${d.getMonth() !== mo ? "out" : ""} ${k === today ? "today" : ""}`}>
              <span className="n">{d.getDate()}</span>
              {evs.map((e) => <Link key={e.id} href={`/events/${e.slug}`} title={e.title}>{e.title}</Link>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
