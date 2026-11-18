"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EventRow } from "@/lib/types";
import EventCard from "./EventCard";
import { EVENT_TYPES, LUMA_URL, TOPICS } from "@/lib/kleros";
import { endOf, isPast, latestFirst, matchesWords, plural, soonestFirst, todayIso } from "@/lib/format";

export type When = "all" | "upcoming" | "past";
export type View = "list" | "calendar";
type Counts = { talks: Record<string, number>; materials: Record<string, number>; going: Record<string, number> };

const WHEN: [When, string][] = [["all", "All"], ["upcoming", "Upcoming"], ["past", "Past"]];

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
  const [month, setMonth] = useState(() => { const [y, m] = initialMonth.split("-").map(Number); return new Date(y, m - 1, 1, 12); });

  // Keep the address shareable without reloading the page.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (when === "all") u.searchParams.delete("when"); else u.searchParams.set("when", when);
    if (view === "list") u.searchParams.delete("view"); else u.searchParams.set("view", view);
    u.searchParams.delete("role");
    window.history.replaceState(null, "", u.pathname + u.search);
  }, [when, view]);

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
  const clear = () => { setType(""); setTopic(""); setQ(""); setRec(false); };

  const shownCount = view === "calendar" ? matching.length : when === "upcoming" ? upcoming.length : when === "past" ? past.length : matching.length;

  return (
    <div className="browser">
      <div className="toolbar">
        {/* stays in calendar view (disabled) so the toolbar does not shift */}
        <div className="seg" role="group" aria-label="Timeline" title={view === "calendar" ? "The calendar shows every event" : undefined}>
          {WHEN.map(([v, l]) => (
            <button key={v} aria-pressed={view === "list" && when === v} disabled={view === "calendar"} onClick={() => setWhen(v)}>
              {l}{v !== "all" && <span className="n">{v === "upcoming" ? upcoming.length : past.length}</span>}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
          <button aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>Calendar</button>
        </div>
      </div>

      <div className="refine">
        <input className="search" type="search" placeholder="Search by name, city or topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        <select className="f" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
          <option value="">All topics</option>{topics.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="f" value={type} onChange={(e) => setType(e.target.value)} aria-label="Event type">
          <option value="">All formats</option>{types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="chip rec-chip" aria-pressed={rec} onClick={() => setRec(!rec)}>▶ With recorded talks</button>
      </div>
      <div className="result-line" role="status">
        <span>{plural(shownCount, "event")}{filtered ? " match" : ""}</span>
        {filtered && <button className="link-btn" onClick={clear}>Clear filters</button>}
      </div>

      {!events.length ? (
        <div className="empty"><b>No events on record yet</b>The Kleros team adds events here. Upcoming ones also appear on <a href={LUMA_URL} target="_blank" rel="noopener">Luma</a>.</div>
      ) : view === "calendar" ? (
        <>
          <MonthGrid month={month} setMonth={setMonth} events={matching} />
          <MonthList month={month} events={matching} counts={counts} />
        </>
      ) : (
        <>
          {/* in "All" with nothing coming up, one quiet line instead of an empty "Upcoming 0" section */}
          {when === "all" && !upcoming.length ? (
            !filtered && <p className="quiet-empty">No upcoming events announced yet. New ones are posted on <a href={LUMA_URL} target="_blank" rel="noopener">Luma</a> first.</p>
          ) : when !== "past" && (
            <Timeline title={when === "all" ? "Upcoming" : undefined} list={upcoming} counts={counts}
              empty={filtered ? "No upcoming events match." : <>No upcoming events announced yet. New ones are posted on <a href={LUMA_URL} target="_blank" rel="noopener">Luma</a> first.</>} />
          )}
          {when !== "upcoming" && (
            <Timeline title={when === "all" ? "Past" : undefined} list={past} counts={counts} byYear limit={filtered ? undefined : 12}
              empty={filtered ? "No past events match." : "No past events on record yet."} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * A titled list of event cards. `byYear` puts a year heading before each year's cards; `limit`
 * shows that many cards first, with a button for the rest (searching or filtering shows all).
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
      {title && <h2 className="tl-h">{title} <span className="count">{list.length}</span></h2>}
      {!list.length ? <p className="quiet-empty">{empty}</p>
        : years.length > 1 ? years.map((y) => (
          <div key={y} className="year">
            <h3 className="month-h">{y} · {plural(list.filter((e) => e.starts_on.startsWith(y)).length, "event")}</h3>
            <div className="ev-grid">{shown.filter((e) => e.starts_on.startsWith(y)).map(card)}</div>
          </div>
        ))
        : <div className="ev-grid">{shown.map(card)}</div>}
      {shown.length < list.length && (
        <button className="btn more" onClick={() => setAll(true)}>Show all {plural(list.length, "event")}</button>
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
      <h3 className="month-h">{list.length ? `${plural(list.length, "event")} in ${label}` : `Nothing on record for ${label}`}</h3>
      {list.length > 0 && (
        <div className="ev-grid">
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
        <h3>{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h3>
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
