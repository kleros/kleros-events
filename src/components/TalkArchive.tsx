"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { EventRow, Material, MaterialKind } from "@/lib/types";
import { fmtRange, latestFirst, matchesWords, place, plural } from "@/lib/format";
import { LinkList, MATERIAL_GROUPS, PhotoGrid, TalkCard, byTalkRank, isWatchable, talkRank } from "./MaterialRow";

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

// Events shown at first, and posts and links shown per event before "Show all".
const EVENTS_STEP = 8;
const ROWS_FIRST = 4;

/** "Photos, posts and links": the groups a panel holds, in words. */
function filesLabel(items: Material[]) {
  const words = MATERIAL_GROUPS.filter((g) => items.some((m) => g.kinds.includes(m.kind))).map((g) => g.label.toLowerCase());
  const s = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0] ?? "links";
  return (s[0].toUpperCase() + s.slice(1)).replace(/ and links and posts$/, ", links and posts");
}

const isPhoto = (m: Material) => m.kind === "image" && !!m.file_path;

export default function TalkArchive({ materials, events }: { materials: Material[]; events: Ev[] }) {
  const [tab, setTab] = useState<Tab>(DEFAULT_TAB);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(EVENTS_STEP);
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
  const shown = new Set(list.map(({ m }) => m.id)).size;
  const visible = needle ? groups : groups.slice(0, limit);
  // posts and links fold after a few, unless searching or on a tab that shows only them
  const rowsFirst = needle || tab === "slides" || tab === "posts" ? Infinity : ROWS_FIRST;

  return (
    <div className="archive">
      <div className="arch-tools">
        <div className="tabs" role="group" aria-label="Type">
          {TABS.map((t) => <button key={t.v} type="button" aria-pressed={tab === t.v} onClick={() => setTab(t.v)}>{t.label}</button>)}
        </div>
        <input className="search" type="search" placeholder="Search by title, speaker or event" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the talks" />
      </div>
      <p className="result-line" role="status">
        {needle ? <>{plural(shown, current.one, current.many)} from {plural(groups.length, "event")} · <button type="button" className="link-btn" onClick={() => setQ("")}>Clear search</button></> : null}
      </p>

      {visible.map(({ e, items }) => {
        const watch = items.filter(isWatchable).sort(byTalkRank);
        const full = watch.filter((m) => talkRank(m) === 0);
        // clips and videos with no speaker fold under the full talks
        const extra = watch.filter((m) => talkRank(m) !== 0);
        const rest = items.filter((m) => !isWatchable(m));
        const extraGrid = <div className="grid four">{extra.map((m) => <TalkCard key={m.id} m={m} event={e} showEvent={false} />)}</div>;
        return (
          <section key={e.id} className="arch-event">
            <header className="arch-h">
              <h2><Link href={`/events/${e.slug}`}>{e.title}</Link></h2>
              <p className="arch-meta">{fmtRange(e.starts_on, e.ends_on)} · {place(e)} · {plural(items.length, current.one, current.many)}</p>
            </header>
            {full.length > 0 && <div className="grid">{full.map((m) => <TalkCard key={m.id} m={m} event={e} showEvent={false} />)}</div>}
            {extra.length > 0 && (full.length > 0
              ? (
                <details className="fold" open={!!needle}>
                  <summary>Clips and short videos ({extra.length})</summary>
                  {extraGrid}
                </details>
              )
              : extraGrid)}
            {rest.length > 0 && (
              <div className="arch-files">
                <h3 className="sub-h">{filesLabel(rest)}</h3>
                <PhotoGrid items={rest.filter(isPhoto)} />
                <LinkList items={rest.filter((m) => !isPhoto(m))} first={rowsFirst} />
              </div>
            )}
          </section>
        );
      })}
      {visible.length < groups.length && (
        <div className="arch-more">
          <button type="button" className="btn more" onClick={() => setLimit((n) => n + EVENTS_STEP)}>Show older events ({plural(groups.length - visible.length, "more event")})</button>
        </div>
      )}
      {!groups.length && (
        <div className="empty">
          <b>{!materials.length ? "Nothing here yet" : needle ? "Nothing matches" : `No ${current.many} yet`}</b>
          {materials.length ? (needle ? "Try another type or a shorter search." : tab === "talks" ? "Try Everything to see slides, photos and posts too." : tab !== "all" ? "Try Everything to see all talks, files and links." : "Try another type.") : "Talks, slides and recordings appear here after each event."}
        </div>
      )}
    </div>
  );
}
