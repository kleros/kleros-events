import Link from "next/link";
import type { EventRow } from "@/lib/types";
import { KLEROS_HOSTED, ROLE_LABEL } from "@/lib/kleros";
import { excerpt, fmtRange, isLive, plural, place } from "@/lib/format";
import { fileUrl } from "./MaterialRow";
import Thumb from "./Thumb";
import { coverPick } from "@/lib/cover/pick";
import { coverTree } from "@/lib/cover/tree";
import { toReact } from "@/lib/cover/react";

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
 * The visual top of an event: its official poster shown whole (see lib/cover/pick.ts), else the designed Kleros
 * cover, which also stands in quietly when the poster's link is broken.
 */
export function EventCover({ e, className = "" }: { e: EventRow; className?: string }) {
  const designed = toReact(coverTree(e, { variant: "card" }));
  const pick = coverPick(e);
  return (
    <span className={`cover ${className}`} style={pick?.bg ? { background: pick.bg } : undefined}>
      {pick ? <Thumb src={fileUrl(pick.src)} contain={pick.fit !== "cover"} position={pick.position} fallback={designed} /> : designed}
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
  // the title is the one link; it stretches over the whole card, so the card stays clickable
  // and a screen reader hears the event's name instead of the whole card read out as a link
  return (
    <article className="card ev">
      <EventCover e={e} />
      <div className="body">
        <p className="card-meta">
          {status && <><span className={`st ${status.cls}`}>{status.text}</span> · </>}
          <time dateTime={e.starts_on}>{fmtRange(e.starts_on, e.ends_on)}</time> · {place(e)}
        </p>
        <h3><Link className="stretch" href={`/events/${e.slug}`}>{e.title}</Link></h3>
        {text && <p className="desc-clamp">{text}</p>}
        <p className="card-foot">{ROLE_LABEL[e.kleros_role]}{count && <> · <b>{count}</b></>}</p>
        {why && <p className="why">{why}</p>}
        {mine && <p className="why">{mine}</p>}
      </div>
    </article>
  );
}
