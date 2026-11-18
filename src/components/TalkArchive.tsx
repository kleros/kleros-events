"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { EventRow, Material, MaterialKind } from "@/lib/types";
import { fmtRange, latestFirst, matchesWords, place, plural } from "@/lib/format";
import { ArchiveRow, MATERIAL_GROUPS, TalkCard, byTalkRank, isWatchable } from "./MaterialRow";
import { EventCover } from "./EventCard";

type Tab = "all" | "talks" | "slides" | "posts";
// The page is called Talks, so it opens on the talks; "Everything" adds slides, photos and posts.
const TABS: { v: Tab; label: string; kinds: MaterialKind[] | null; one: string; many: string }[] = [
  { v: "talks", label: "Talks", kinds: ["talk", "video", "audio"], one: "talk", many: "talks" },
  { v: "slides", label: "Slides", kinds: ["slides", "doc"], one: "file", many: "files" },
  { v: "posts", label: "Photos and posts", kinds: ["image", "social", "link"], one: "photo or post", many: "photos and posts" },
  { v: "all", label: "Everything", kinds: null, one: "talk, file or link", many: "talks, files and links" },
];
const DEFAULT_TAB: Tab = "talks";

type Ev = EventRow;

// Events shown at first, and posts and links shown per event before "Show more".
const EVENTS_STEP = 8;
const ROWS_FIRST = 4;

/** "Photos, posts and links": the groups a panel holds, in words. */
function filesLabel(items: Material[]) {
  const words = MATERIAL_GROUPS.filter((g) => items.some((m) => g.kinds.includes(m.kind))).map((g) => g.label.toLowerCase());
  const s = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0] ?? "links";
  return (s[0].toUpperCase() + s.slice(1)).replace(/ and links and posts$/, ", links and posts");
}

export default function TalkArchive({ materials, events }: { materials: Material[]; events: Ev[] }) {
  const [tab, setTab] = useState<Tab>(DEFAULT_TAB);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(EVENTS_STEP);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));
  const current = TABS.find((t) => t.v === tab)!;
  const kinds = current.kinds;
  const needle = q.trim();

  // Start from ?type= and ?q= so a filtered view can be shared, and keep the address in step.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("type");
    if (t && TABS.some((x) => x.v === t)) setTab(t as Tab);
    if (p.get("q")) setQ(p.get("q")!);
  }, []);
  useEffect(() => {
    const u = new URL(window.location.href);
    if (tab === DEFAULT_TAB) u.searchParams.delete("type"); else u.searchParams.set("type", tab);
    if (needle) u.searchParams.set("q", needle); else u.searchParams.delete("q");
    window.history.replaceState(null, "", u.pathname + u.search);
  }, [tab, needle]);

  // A material linked to several events is listed under each of them.
  const evs = (m: Material) => (m.event_ids ?? (m.event_id ? [m.event_id] : [])).map((id) => byId[id]).filter(Boolean);
  const pairs = materials.flatMap((m) => evs(m).map((e) => ({ m, e })));
  // every word anywhere, accents ignored: "clement devcon" finds Clément Lesaege's Devcon talk
  const matches = (m: Material, e: Ev) => !needle || matchesWords([m.title, m.speaker, e.title, e.city, e.country].filter(Boolean).join(" "), needle);
  const list = pairs.filter(({ m, e }) => (!kinds || kinds.includes(m.kind)) && matches(m, e));
  const groups = [...new Set(list.map(({ e }) => e.id))].map((id) => byId[id]).sort(latestFirst)
    .map((e) => ({ e, items: list.filter((x) => x.e.id === e.id).map((x) => x.m).sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
  // the counts follow the search, so a search that finds 3 talks says so on the tab
  const tabCount = (t: (typeof TABS)[number]) => new Set(pairs.filter(({ m, e }) => (!t.kinds || t.kinds.includes(m.kind)) && matches(m, e)).map(({ m }) => m.id)).size;
  const shown = new Set(list.map(({ m }) => m.id)).size;
  const visible = needle ? groups : groups.slice(0, limit);

  return (
    <div className="browser">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Type">
          {TABS.map((t) => <button key={t.v} aria-pressed={tab === t.v} onClick={() => setTab(t.v)}>{t.label} <span className="n">{tabCount(t)}</span></button>)}
        </div>
      </div>
      <div className="refine">
        <input className="search" type="search" placeholder="Search by title, speaker or event" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the archive" />
      </div>
      <div className="result-line" role="status">
        <span>{plural(shown, current.one, current.many)} from {plural(groups.length, "event")}</span>
        {needle && <button className="link-btn" onClick={() => setQ("")}>Clear search</button>}
      </div>

      {visible.map(({ e, items }) => {
        const watch = items.filter(isWatchable).sort(byTalkRank);
        const rest = items.filter((m) => !isWatchable(m));
        // posts and links fold after a few, unless searching or on a tab that shows only them
        const full = open.has(e.id) || !!needle || tab === "slides" || tab === "posts";
        const rows = full ? rest : rest.slice(0, ROWS_FIRST);
        return (
          <section key={e.id} className="arch-event">
            <header className="arch-h">
              <Link className="arch-cover" href={`/events/${e.slug}`} tabIndex={-1} aria-hidden><EventCover e={e} /></Link>
              <div className="arch-t">
                <h2><Link href={`/events/${e.slug}`}>{e.title}</Link></h2>
                <span className="muted small">{fmtRange(e.starts_on, e.ends_on)} · {place(e)} · {plural(items.length, current.one, current.many)}</span>
              </div>
              <Link className="btn sm ghost arch-go" href={`/events/${e.slug}`}>Event page →</Link>
            </header>
            {/* talk cards first, then slides, audio and links in one panel below */}
            {watch.length > 0 && <div className="media">
              {watch.map((m) => <TalkCard key={m.id} m={m} event={e} showEvent={false} />)}
            </div>}
            {rest.length > 0 && (
              <div className="files">
                <h3 className="sub-h">{filesLabel(rest)}</h3>
                <div className="lib cols">{rows.map((m) => <ArchiveRow key={m.id} m={m} eventSlug={e.slug} />)}</div>
                {rows.length < rest.length && (
                  <button className="link-btn" onClick={() => setOpen(new Set(open).add(e.id))}>Show {rest.length - rows.length} more</button>
                )}
              </div>
            )}
          </section>
        );
      })}
      {visible.length < groups.length && (
        <button className="btn more" onClick={() => setLimit((n) => n + EVENTS_STEP)}>Show older events ({plural(groups.length - visible.length, "more event")})</button>
      )}
      {!groups.length && (
        <div className="empty">
          <b>{materials.length ? "Nothing matches" : "Nothing in the archive yet"}</b>
          {materials.length ? (tab !== "all" && !needle ? "Try Everything to see slides, photos and posts too." : "Try another type or a shorter search.") : "Talks, slides and recordings appear here after each event."}
        </div>
      )}
    </div>
  );
}
