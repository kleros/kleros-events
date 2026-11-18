"use client";
import { Fragment, useState } from "react";
import { matchesWords, plural } from "@/lib/format";

/** One event row, already drawn on the server, with the words it can be found by. */
export type DeskItem = { key: string; text: string; row: React.ReactNode };

/** The search box over the desk's event list. It only hides the rows that do not match. */
export default function DeskSearch({ items }: { items: DeskItem[] }) {
  const [q, setQ] = useState("");
  const shown = items.filter((i) => matchesWords(i.text, q));
  const searching = !!q.trim();
  return (
    <div className="stack">
      <div className="desk-tools">
        <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, city, country or date" aria-label="Search events" />
        <span className="muted small" aria-live="polite">{searching ? `${shown.length} of ${plural(items.length, "event")} shown` : ""}</span>
      </div>
      {shown.length ? (
        <ul className="desk-list">{shown.map((i) => <Fragment key={i.key}>{i.row}</Fragment>)}</ul>
      ) : (
        <div className="empty"><b>Nothing matches</b>Try a shorter search, or look in another tab.</div>
      )}
    </div>
  );
}
