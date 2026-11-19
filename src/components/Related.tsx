import type { Related as R } from "@/lib/related";
import EventCard from "./EventCard";
import { TalkCard } from "./MaterialRow";
import Ext from "./Ext";

const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];

/** Kleros pages, docs and articles as plain rows: the title, what it is and where it opens, one line on it. */
export function ReadList({ reads }: { reads: R["reads"] }) {
  if (!reads.length) return null;
  return (
    <ul className="links reads">
      {reads.map(({ r, because }) => (
        <li key={r.id}>
          <a className="link-row read-row" href={r.url} target="_blank" rel="noopener">
            <span className="link-t">{r.title}</span>
            <span className="link-s">{r.kind} · {host(r.url)}<Ext /></span>
            <span className="read-d">{because ? `${because}. ` : ""}{r.blurb}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * "You might also like": related talks, events and Kleros reading (lib/related.ts). `variant` follows the
 * page: event pages use .sec sections, the talk and Saved pages use .block. Renders nothing when empty.
 */
export default function Related({ data, title = "You might also like", lede, variant = "block", id = "related" }: {
  data: R; title?: string; lede?: string; variant?: "block" | "sec"; id?: string;
}) {
  const { talks, events, reads } = data;
  if (!talks.length && !events.length && !reads.length) return null;
  const groups = [talks.length, events.length, reads.length].filter(Boolean).length;
  const head = (t: string) => (groups > 1 ? <h3 className="sub-h">{t}</h3> : null);
  const body = (
    <>
      {talks.length > 0 && (
        <div className="rel-group">
          {head("Talks")}
          <div className="grid">{talks.map(({ m, event, because }) => <TalkCard key={m.id} m={m} event={event} note={because} />)}</div>
        </div>
      )}
      {events.length > 0 && (
        <div className="rel-group">
          {head("Events")}
          <div className="grid">{events.map(({ e, because }) => <EventCard key={e.id} e={e} why={because} />)}</div>
        </div>
      )}
      {reads.length > 0 && (
        <div className="rel-group">
          {head("Read more from Kleros")}
          <ReadList reads={reads} />
        </div>
      )}
    </>
  );
  return variant === "sec" ? (
    <section id={id} className="sec related">
      <h2>{title}</h2>
      {lede && <p className="muted small">{lede}</p>}
      {body}
    </section>
  ) : (
    <section id={id} className="block related">
      <div className="section-h"><h2>{title}</h2></div>
      {lede && <p className="muted small rel-lede">{lede}</p>}
      {body}
    </section>
  );
}
