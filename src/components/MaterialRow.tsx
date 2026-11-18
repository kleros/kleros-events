import Link from "next/link";
import type { EventRow, Material, MaterialKind } from "@/lib/types";
import { fmtDur, fmtSize, plural } from "@/lib/format";
import Thumb from "./Thumb";
import GenCover from "./Cover";

const KIND: Record<string, string> = { talk: "TALK", slides: "PDF", audio: "AUD", video: "VID", doc: "DOC", image: "IMG", link: "URL", social: "POST" };
// slides kept as a link (Google Slides, a claude.ai deck) are not a PDF
// and a photo kept only as a link (a post on X) is a post
const badge = (m: Pick<Material, "kind" | "file_path">) =>
  m.kind === "slides" && !m.file_path ? "DECK" : m.kind === "image" && !m.file_path ? "POST" : KIND[m.kind] ?? "FILE";

/**
 * Where the site serves a stored file: /f/<path>, which hands out a signed storage address to
 * visitors allowed to see the file (src/app/f/[...path]/route.ts). Full URLs stay as they are.
 */
export function fileUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return linkUrl(path);
  return `/f/${path.split("/").map(encodeURIComponent).join("/")}`;
}

const OLD_PUBLIC = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/materials/`;

/**
 * A stored link as it should be shown. The public file address used before the materials bucket
 * became private (migration 0014) no longer works, so one pasted into an item, a cover or a roster
 * photo goes to /f/ instead, under the same rules as any other file. Anything else stays as it is.
 */
export function linkUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !url.startsWith(OLD_PUBLIC)) return url;
  try {
    return fileUrl(url.slice(OLD_PUBLIC.length).split(/[?#]/)[0].split("/").map(decodeURIComponent).join("/"));
  } catch {
    return url;
  }
}

// Talks people can sit down and watch: slide-synced talks and video recordings.
export const isWatchable = (m: Pick<Material, "kind">) => m.kind === "talk" || m.kind === "video";
// What the event page lists under Talks: watchable talks plus recordings saved as audio files.
export const isTalkLike = (m: Pick<Material, "kind" | "file_path">) => isWatchable(m) || (m.kind === "audio" && !!m.file_path);

export const driveId = (url: string | null | undefined) =>
  url?.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/)?.[1];
export const youtubeId = (url: string | null | undefined) =>
  url?.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1];

/** A preview image for a video, when the link points somewhere that has one. */
export function videoThumb(m: Pick<Material, "kind" | "url">) {
  if (m.kind !== "video") return null;
  const d = driveId(m.url);
  if (d) return `https://drive.google.com/thumbnail?id=${d}&sz=w640`;
  const y = youtubeId(m.url);
  if (y) return `https://i.ytimg.com/vi/${y}/hqdefault.jpg`;
  return null;
}

/** A short excerpt of a longer talk: its title starts with "Clip". */
export const isClip = (m: Pick<Material, "title">) => /^clip\b/i.test(m.title.trim());

/**
 * Order of talks within one event: full talks first, then clips, then videos with no speaker
 * (a preview stream, directions to the booth). Sorting is stable, so each group keeps its order.
 */
export const talkRank = (m: Pick<Material, "title" | "speaker">) => (isClip(m) ? 1 : !m.speaker ? 2 : 0);
export const byTalkRank = (a: Pick<Material, "title" | "speaker">, b: Pick<Material, "title" | "speaker">) => talkRank(a) - talkRank(b);

/**
 * "Title (format, date, source)" split into the title and its note, so cards show the note on
 * its own line instead of cutting it off. Titles without a trailing note stay whole.
 */
export function splitTitle(t: string) {
  const x = t.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  return x && x[1].length >= 20 ? { main: x[1], aside: x[2] } : { main: t, aside: "" };
}

const SOURCES: [RegExp, string][] = [
  [/(^|\.)(x|twitter)\.com$/, "X"], [/(^|\.)linkedin\.com$/, "LinkedIn"], [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/^drive\.google\.com$/, "Google Drive"], [/^docs\.google\.com$/, "Google Docs"], [/(^|\.)luma\.com$|^lu\.ma$/, "Luma"],
];
/** Where a link opens, in words a visitor knows: X, LinkedIn, YouTube, or the site's own name. */
export function sourceOf(url: string | null | undefined) {
  const h = hostOf(url ?? null);
  return SOURCES.find(([r]) => r.test(h))?.[1] ?? h;
}

/** What a watchable item is, for card footers and talk pages: "Clip on X", "Video on YouTube". */
export function watchLabel(m: Pick<Material, "kind" | "title" | "url" | "file_path" | "pages">) {
  if (m.kind === "talk") return m.pages ? plural(m.pages, "slide") + " with audio" : "Slides with audio";
  if (m.kind === "audio") return m.url ? "Recording with slides" : "Audio recording";
  const src = m.url && !m.file_path ? sourceOf(m.url) : "";
  return (isClip(m) ? "Clip" : "Video") + (src ? ` on ${src}` : "");
}

/** How the archive and the event page group materials, in display order. */
export const MATERIAL_GROUPS: { label: string; kinds: MaterialKind[] }[] = [
  { label: "Slides", kinds: ["slides"] },
  { label: "Audio", kinds: ["audio"] },
  { label: "Documents", kinds: ["doc"] },
  { label: "Photos", kinds: ["image"] },
  { label: "Links and posts", kinds: ["link", "social"] },
];

type EventRef = Pick<EventRow, "slug" | "title" | "starts_on">;

/**
 * A watchable talk: preview, title, speaker and a clear Watch action. `event` names the event
 * under the title; leave `showEvent` off where cards already sit under their event.
 */
export function TalkCard({ m, event, note, showEvent = true }: { m: Material; event?: EventRef; note?: string; showEvent?: boolean }) {
  const href = `/talks/${m.id}`;
  const verb = m.kind === "audio" ? "Listen" : "Watch";
  const { main, aside } = splitTitle(m.title);
  const coverLabel = m.kind === "talk" ? "Talk with slides" : isClip(m) ? "Clip" : "Recording";
  return (
    <article className="card talk">
      <Link className="cover" href={href} aria-label={`${verb}: ${m.title}`} tabIndex={-1}>
        <Thumb src={videoThumb(m)} fallback={
          <GenCover seed={event?.slug ?? m.event_id ?? m.id} className="talk-gen" big={m.speaker ?? undefined} small={coverLabel}>
            <span className="play">▶</span>
          </GenCover>
        } />
        {m.duration_seconds ? <span className="dur mono">{fmtDur(m.duration_seconds)}</span> : null}
      </Link>
      <div className="body">
        <h3 title={aside ? m.title : undefined}><Link href={href}>{main}</Link></h3>
        {m.speaker && <div className="who">{m.speaker}</div>}
        {aside && <div className="sub" title={aside}>{aside}</div>}
        {event && showEvent && <Link className="sub" href={`/events/${event.slug}`}>{event.title}</Link>}
        {note && <div className="sub">{note}</div>}
        <div className="foot">
          <Link className="btn sm primary" href={href}>▶ {verb}</Link>
          <span>{watchLabel(m)}</span>
        </div>
      </div>
    </article>
  );
}

/**
 * One archive row, the same shape for every kind: icon or thumbnail, title, speaker and
 * details, and one right-aligned action (Watch, Slides or Open).
 */
export function ArchiveRow({ m, eventSlug }: { m: Material; eventSlug: string }) {
  // a recording's url is its slides link; its own file is the audio
  const file = m.kind === "audio" && m.file_path ? fileUrl(m.file_path) : linkUrl(m.url) || fileUrl(m.file_path);
  const detail = isWatchable(m)
    ? [watchLabel(m), m.duration_seconds ? fmtDur(m.duration_seconds) : ""]
    : [m.url && !m.file_path ? sourceOf(m.url) : "", m.kind === "audio" && m.duration_seconds ? fmtDur(m.duration_seconds) : "", fmtSize(m.size_bytes)];
  const sub = [m.speaker, ...detail].filter(Boolean).join(" · ");
  const thumb = videoThumb(m);
  let action: React.ReactNode;
  if (isWatchable(m)) action = <Link className="btn sm primary" href={`/talks/${m.id}`}>▶ Watch</Link>;
  else if (m.kind === "slides" && m.file_path) action = <Link className="btn sm" href={`/talks/${m.id}`}>Slides</Link>;
  else if (m.kind === "slides" && m.url) action = <a className="btn sm" href={linkUrl(m.url)} target="_blank" rel="noopener">Slides ↗</a>;
  else if (file) action = <a className="btn sm" href={file} target="_blank" rel="noopener">Open ↗</a>;
  else action = <Link className="btn sm" href={`/events/${eventSlug}`}>Open</Link>;
  return (
    <div className="mrow arow">
      {m.kind === "image" && m.file_path
        // eslint-disable-next-line @next/next/no-img-element
        ? <span className="ico pic"><img src={fileUrl(m.file_path)} alt="" loading="lazy" /></span>
        : thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <span className="ico pic"><img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /></span>
          : <span className={`ico ${m.kind}`} aria-hidden>{isWatchable(m) ? "▶" : badge(m)}</span>}
      <div style={{ minWidth: 0 }}>
        <div className="t">{m.title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      <div className="acts">{action}</div>
    </div>
  );
}

/** A compact row for slides, audio, photos, documents, links and posts. */
export default function MaterialRow({ m, eventTitle, eventSlug }: { m: Material; eventTitle?: string; eventSlug?: string }) {
  const href = linkUrl(m.url) || fileUrl(m.file_path);
  const sub = [m.speaker,
    m.kind === "talk" ? `${m.pages ?? "?"} slides${m.duration_seconds ? " · " + fmtDur(m.duration_seconds) : ""}` : "",
    m.kind !== "talk" ? fmtSize(m.size_bytes) : "",
    m.url && !m.file_path && m.kind !== "talk" && m.kind !== "slides" ? sourceOf(m.url) : ""].filter(Boolean).join(" · ");
  return (
    <div className="mrow">
      {m.kind === "image" && m.file_path
        // eslint-disable-next-line @next/next/no-img-element
        ? <a className="ico pic" href={fileUrl(m.file_path)} target="_blank" rel="noopener"><img src={fileUrl(m.file_path)} alt="" loading="lazy" /></a>
        : <div className={`ico ${m.kind}`} aria-hidden>{badge(m)}</div>}
      <div style={{ minWidth: 0 }}>
        <div className="t">{m.title}</div>
        {(sub || eventTitle) && (
          <div className="s">
            {sub}
            {sub && eventTitle && " · "}
            {eventTitle && (eventSlug ? <Link href={`/events/${eventSlug}`}>{eventTitle}</Link> : eventTitle)}
          </div>
        )}
        {m.kind === "audio" && m.file_path && <audio controls preload="none" src={fileUrl(m.file_path)} />}
      </div>
      <div className="acts">
        {isWatchable(m) && <Link className="btn sm primary" href={`/talks/${m.id}`}>▶ Watch</Link>}
        {m.kind === "audio" && m.file_path && <Link className="btn sm" href={`/talks/${m.id}`}>Transcript</Link>}
        {m.kind === "slides" && m.file_path && <Link className="btn sm" href={`/talks/${m.id}`}>View slides</Link>}
        {m.kind === "slides" && !m.file_path && m.url && <a className="btn sm" href={linkUrl(m.url)} target="_blank" rel="noopener">View slides ↗</a>}
        {!isWatchable(m) && m.kind !== "slides" && !(m.kind === "audio" && m.file_path) && href && <a className="btn sm" href={href} target="_blank" rel="noopener">Open ↗</a>}
      </div>
    </div>
  );
}

function hostOf(url: string | null) {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
