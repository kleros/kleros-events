import Link from "next/link";
import type { EventRow } from "@/lib/types";
import { KLEROS_HOSTED, ROLE_LABEL } from "@/lib/kleros";
import { excerpt, fmtRange, isLive, plural, place } from "@/lib/format";
import { fileUrl } from "./MaterialRow";
import EventTile from "./EventTile";
import { coverPick } from "@/lib/cover/pick";

/** One quiet status label at most: private beats draft beats live beats example. */
export function statusLabel(e: Pick<EventRow, "status" | "starts_on" | "ends_on" | "is_example"> & { visibility?: EventRow["visibility"] }) {
  if (e.visibility === "private") return { cls: "draft", text: "Private" };
  if (e.status === "draft") return { cls: "draft", text: "Draft" };
  if (isLive(e)) return { cls: "live", text: "Happening now" };
  if (e.is_example) return { cls: "ex", text: "Example" };
  return null;
}

/** Kleros's part in the event, coloured: violet when Kleros runs it, cyan when it takes part. */
export function RolePill({ e }: { e: Pick<EventRow, "kleros_role"> }) {
  return <span className={`pill ${KLEROS_HOSTED.includes(e.kleros_role) ? "host" : "part"}`}>{ROLE_LABEL[e.kleros_role]}</span>;
}

/**
 * The visual top of an event (components/EventTile.tsx): the Kleros frame with the event's own poster (chosen in
 * lib/cover/pick.ts), its name, dates, place and Kleros's part, so the picture alone says what the event is.
 */
export function EventCover({ e, className = "" }: { e: EventRow; className?: string }) {
  const pick = coverPick(e);
  return (
    <span className={`cover ${className}`}>
      <EventTile
        title={e.title}
        meta={`${fmtRange(e.starts_on, e.ends_on)} · ${place(e)}`}
        role={ROLE_LABEL[e.kleros_role]}
        art={pick ? { src: fileUrl(pick.src), crop: pick.fit === "cover", position: pick.position, bg: pick.bg, logo: pick.logo } : null}
        seed={e.slug}
      />
    </span>
  );
}

export default function EventCard({ e, talks = 0, materials = 0, going = 0, why, mine, showExcerpt = false }: {
  e: EventRow; talks?: number; materials?: number; going?: number; why?: string; mine?: string; showExcerpt?: boolean;
}) {
  const status = statusLabel(e);
  // say what there is to open: talks to watch first, else slides, photos and posts
  const count = talks ? plural(talks, "talk") : materials ? `${materials} ${materials === 1 ? "file or link" : "files and links"}` : going ? `${going} going` : "";
  const text = showExcerpt ? excerpt(e) : "";
  // The tile already shows the name, dates, place and Kleros's part, so the text under it only adds what is
  // new: the status, what there is to open, the summary. The title is still the one link, read out by screen
  // readers (the tile is hidden from them) and stretched over the whole card so the card stays clickable.
  const foot = [status && <span key="s" className={`st ${status.cls}`}>{status.text}</span>, count && <b key="c">{count}</b>].filter(Boolean);
  return (
    <article className="card ev">
      <EventCover e={e} />
      <div className="body">
        <h3 className="ev-h">
          <Link className="stretch" href={`/events/${e.slug}`}>
            <span className="sr-only">{e.title}, {fmtRange(e.starts_on, e.ends_on)}, {place(e)}, {ROLE_LABEL[e.kleros_role]}</span>
          </Link>
        </h3>
        {foot.length > 0 && <p className="card-foot">{foot.map((x, i) => <span key={i}>{i > 0 && " · "}{x}</span>)}</p>}
        {text && <p className="desc-clamp">{text}</p>}
        {why && <p className="why">{why}</p>}
        {mine && <p className="why">{mine}</p>}
      </div>
    </article>
  );
}
