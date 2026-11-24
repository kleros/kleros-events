import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventMaterials, getMaterial, listEvents, listMaterials, visitorDb, type As } from "@/lib/data";
import Related from "@/components/Related";
import { materialProfile, related } from "@/lib/related";
import { fmtDur, plural } from "@/lib/format";
import type { Material } from "@/lib/types";
import TalkPlayer from "@/components/TalkPlayer";
import GenCover from "@/components/Cover";
import { TalkCard, byTalkRank, driveId, fileUrl, isClip, isWatchable, linkUrl, sourceOf, splitTitle, videoThumb, watchLabel, youtubeId } from "@/components/MaterialRow";
import Ext from "@/components/Ext";
import EventChip from "@/components/studio/EventChip";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

// the visitor copy is built for nobody in particular
const NOBODY = { user: null, profile: null } as const;
import RecordingSlides from "@/components/studio/RecordingSlides";
import { getTranscript, transcriptSetup } from "@/lib/transcript/data";
import TranscriptArea from "@/components/transcript/TranscriptArea";
import { MediaPlayer, YouTubePlayer } from "@/components/transcript/MediaPlayers";
import StartAt from "@/components/transcript/StartAt";
import { MaterialEditButton } from "@/components/admin/MaterialEditor";
import SaveButton from "@/components/SaveButton";
import Comments from "@/components/Comments";
import SpeakerNames from "@/components/SpeakerNames";
import PersonChips from "@/components/PersonChips";

/**
 * A talk page. Signed-out visitors get the "public" one: read as a visitor and built ahead (app/talks/[id]). Anyone
 * with a session gets it built for them with their own access: the middleware sends them to app/session/talks/[id].
 */
export async function talkMetadata(id: string, as: As): Promise<Metadata> {
  const [m, t] = await Promise.all([getMaterial(id, as), getTranscript(id, as)]);
  // a signed-out visitor gets a sign-in page here rather than a 404, which search engines must not keep
  if (!m) return { title: "Talk not available", robots: { index: false } };
  // say what the link holds ("Video on YouTube", "Clip on X", "12 slides with audio"), not a fixed phrase
  const what = m.kind === "slides" ? "Slides" : watchLabel(m);
  const fallback = `${m.speaker ? m.speaker + (m.events ? " at " : "") : ""}${m.events?.title ?? ""}. ${what}.`.replace(/^\. /, "");
  const description = t?.summary?.tldr?.slice(0, 300) || fallback;
  // a YouTube or Drive picture for the shared link's preview card
  const img = videoThumb(m);
  return {
    title: m.title, description, alternates: { canonical: `/talks/${m.id}` },
    // with no video picture, the site's own share picture (app/share-image/route.tsx)
    openGraph: { siteName: "Kleros Events", title: m.title, description, images: [img ?? "/share-image"] },
    twitter: { card: "summary_large_image", site: "@kleros_io", title: m.title, description, images: [img ?? "/share-image"] },
  };
}

export default async function TalkView({ id, as }: { id: string; as: As }) {
  // the public lists for "You might also like" load alongside (kept for a minute on the server)
  const [m, { user, profile }, transcript, publicEvents, publicMaterials] = await Promise.all([
    getMaterial(id, as), as === "public" ? NOBODY : currentUser(), getTranscript(id, as), listEvents("public"), listMaterials("public"),
  ]);
  if (!m && !user) return (
    <div className="wrap page con-gate">
      <h1>This talk is not available</h1>
      <p className="muted">The link may be old or mistyped. If this is an internal Kleros talk, sign in with your Kleros email. If someone added you as a guest, sign in with the email address they used.</p>
      <div className="row-flex">
        <Link className="btn primary" href="/talks">All talks</Link>
        <Link className="btn" href={`/login?next=${encodeURIComponent(`/talks/${id}`)}`}>Sign in</Link>
      </div>
    </div>
  );
  if (!m || !(m.kind === "talk" || m.kind === "slides" || m.kind === "video" || (m.kind === "audio" && m.file_path))) notFound();
  const pdf = fileUrl(m.kind === "talk" ? m.pdf_path : m.file_path);
  const drive = driveId(m.url);
  const yt = youtubeId(m.url);
  const isTeam = !!(profile?.is_team || profile?.is_admin);
  // One round of lookups: whether this account edits the item (the team, or a private event's members) and the
  // other items of its event, for "what to watch next". The visitor copy reads as a visitor and edits nothing.
  const sb = as === "public" ? visitorDb() : await supabaseServer();
  const [editable, siblings] = await Promise.all([
    user ? sb.rpc("material_editable", { p_material: m.id }).then((r) => !!r.data) : false,
    m.events ? eventMaterials(sb, m.events.id) : ([] as Material[]),
  ]);
  // editors manage the slides of a recording and rename the item (videos and slides have no slide editor)
  const canEdit = editable && (m.kind === "talk" || m.kind === "audio");
  const canRename = editable;

  let player: React.ReactNode;
  let canSeek = false;
  if (m.kind === "video") {
    if (drive) player = <div className="video" data-player><iframe src={`https://drive.google.com/file/d/${drive}/preview`} allow="autoplay; fullscreen" allowFullScreen title={m.title} /></div>;
    else if (yt) { player = <YouTubePlayer id={yt} title={m.title} />; canSeek = true; }
    else if (m.file_path) { player = <MediaPlayer kind="video" src={fileUrl(m.file_path)} title={m.title} />; canSeek = true; }
    // a video that can't play here (a clip posted on X): a poster that clearly opens it where it lives
    else if (m.url) player = (
      <a className="video ext" href={linkUrl(m.url)} target="_blank" rel="noopener">
        <GenCover seed={m.id}>
          <span className="play" aria-hidden="true">▶</span>
        </GenCover>
        <span className="ext-go">Watch on {sourceOf(m.url) || "the original site"}<Ext /></span>
      </a>
    );
  } else if (m.kind === "audio") {
    player = <MediaPlayer kind="audio" src={fileUrl(m.file_path)} title={m.title} />;
    canSeek = true;
  } else {
    player = <TalkPlayer materialId={m.id} pdfUrl={pdf} audioUrl={m.kind === "talk" ? fileUrl(m.audio_path) : undefined} marks={m.marks} notes={m.notes} signedIn={!!user} />;
    canSeek = m.kind === "talk" && !!m.audio_path;
  }

  const recorded = m.kind === "talk" || m.kind === "audio" || m.kind === "video";
  const canTranscribe = (m.kind === "talk" && !!m.audio_path) || ((m.kind === "audio" || m.kind === "video") && !!m.file_path);
  const { main, aside } = splitTitle(m.title);
  const detailRest = [aside, (m.kind === "talk" || m.kind === "slides") && m.pages ? plural(m.pages, "slide") : "", m.duration_seconds ? fmtDur(m.duration_seconds) : ""].filter(Boolean).join(" · ");

  // What to watch next: the other talks of the same event, and for a clip, the session it comes from.
  const people = (s: string | null) => (s ?? "").toLowerCase().split(/,|\band\b|&/).map((x) => x.trim()).filter(Boolean);
  const sharesSpeaker = (o: Material) => people(o.speaker).some((p) => people(m.speaker).includes(p));
  const fullSession = isClip(m) ? siblings.find((o) => o.id !== m.id && isWatchable(o) && !isClip(o) && sharesSpeaker(o)) : undefined;
  const clips = !isClip(m) ? siblings.filter((o) => o.id !== m.id && isWatchable(o) && isClip(o) && sharesSpeaker(o)) : [];
  const more = siblings.filter((o) => o.id !== m.id && o.id !== fullSession?.id && isWatchable(o) && !clips.includes(o))
    .sort((a, b) => Number(!sharesSpeaker(a)) - Number(!sharesSpeaker(b)) || byTalkRank(a, b)).slice(0, 3);

  // You might also like: talks from other events, events and Kleros reading on the same subject (lib/related.ts).
  // A private event's talk is an internal meeting, so it gets none.
  const pub = !!m.events && m.events.visibility !== "private";
  const [allEvents, allMaterials] = pub ? [publicEvents, publicMaterials] : [[], []];
  const shown = new Set([m.id, fullSession?.id, ...clips.map((o) => o.id), ...more.map((o) => o.id), ...siblings.map((o) => o.id)].filter((x): x is string => !!x));
  const evById = Object.fromEntries(allEvents.map((e) => [e.id, e]));
  const alsoLike = pub
    ? related([{ id: m.id, label: main, profile: materialProfile(m, evById) }], allEvents, allMaterials, { exclude: shown, talks: 3, events: 2, reads: 4 })
    : { talks: [], events: [], reads: [] };

  return (
    <div className="wrap page stack">
      <div>
        {m.events
          ? <Link href={`/events/${m.events.slug}`} className="back">← {m.events.title}</Link>
          : <Link href="/admin/recordings" className="back">← Recordings library</Link>}
        <h1 className="talk-title">{main}</h1>
        <div className="muted small">{m.speaker && <SpeakerNames speaker={m.speaker} />}{m.speaker && detailRest && " · "}{detailRest}</div>
        <PersonChips speaker={m.speaker} />
        {m.events && <div className="talk-save"><SaveButton id={m.id} next={`/talks/${m.id}`} /></div>}
        {canRename && <div className="talk-edit"><MaterialEditButton m={{ id: m.id, title: m.title, speaker: m.speaker }} label="Edit title or speaker" /></div>}
        {m.linkedEvents.length > 1 && (
          <div className="talk-events">
            <span className="muted small">Presented at</span>
            {m.linkedEvents.map((e) => <EventChip key={e.id} e={e} />)}
          </div>
        )}
        {!m.events && isTeam && (
          <div className="note talk-unlinked">Not linked to any event yet, so only the Kleros team can see it. <Link href="/admin/recordings">Link it to events</Link></div>
        )}
      </div>
      {(m.kind === "talk" || m.kind === "audio") && <RecordingSlides m={m} canEdit={canEdit} />}
      {canSeek && <Suspense><StartAt /></Suspense>}
      {recorded && (transcript || isTeam) ? (
        <TranscriptArea materialId={m.id} title={m.title} speaker={m.speaker} initial={transcript} isTeam={isTeam}
          canSeek={canSeek} canTranscribe={canTranscribe} setup={transcriptSetup()} durationHint={m.duration_seconds}>
          {player}
        </TranscriptArea>
      ) : player}
      {m.events && (
        <section className="block" id="comments">
          <div className="section-h"><h2>Comments</h2></div>
          <Comments materialId={m.id} signedIn={!!user} canModerate={canRename} next={`/talks/${m.id}#comments`} displayName={profile?.display_name} />
        </section>
      )}
      {fullSession && (
        <p className="full-session-line">
          <Link className="full-session" href={`/talks/${fullSession.id}`}>From the full session: <b>{splitTitle(fullSession.title).main}</b> →</Link>
        </p>
      )}
      {clips.length > 0 && (
        <section className="block">
          <div className="section-h"><h2>Clips from this talk</h2></div>
          <div className="grid">{clips.slice(0, 3).map((o) => <TalkCard key={o.id} m={o} showEvent={false} />)}</div>
        </section>
      )}
      {m.events && more.length > 0 && (
        <section className="block">
          <div className="section-h"><h2>More from {m.events.title}</h2><Link href={`/events/${m.events.slug}#talks`}>All talks of this event →</Link></div>
          <div className="grid">{more.map((o) => <TalkCard key={o.id} m={o} showEvent={false} />)}</div>
        </section>
      )}
      <Related data={alsoLike} />
    </div>
  );
}
