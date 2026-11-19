import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventMaterials, getMaterial } from "@/lib/data";
import { fmtDur, plural } from "@/lib/format";
import type { Material } from "@/lib/types";
import TalkPlayer from "@/components/TalkPlayer";
import GenCover from "@/components/Cover";
import { TalkCard, byTalkRank, driveId, fileUrl, isClip, isWatchable, linkUrl, sourceOf, splitTitle, videoThumb, watchLabel, youtubeId } from "@/components/MaterialRow";
import Ext from "@/components/Ext";
import EventChip from "@/components/studio/EventChip";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [m, t] = await Promise.all([getMaterial(id), getTranscript(id)]);
  // a signed-out visitor gets a sign-in page here rather than a 404, which search engines must not keep
  if (!m) return { title: "Talk not available", robots: { index: false } };
  // say what the link holds ("Video on YouTube", "Clip on X", "12 slides with audio"), not a fixed phrase
  const what = m.kind === "slides" ? "Slides" : watchLabel(m);
  const fallback = `${m.speaker ? m.speaker + (m.events ? " at " : "") : ""}${m.events?.title ?? ""}. ${what}.`.replace(/^\. /, "");
  const description = t?.summary?.tldr?.slice(0, 300) || fallback;
  // a YouTube or Drive picture for the shared link's preview card
  const img = videoThumb(m);
  return {
    title: m.title, description,
    openGraph: { siteName: "Kleros Events", title: m.title, description, ...(img ? { images: [img] } : {}) },
    twitter: { card: img ? "summary_large_image" : "summary", site: "@kleros_io", title: m.title, description, ...(img ? { images: [img] } : {}) },
  };
}

export default async function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [m, { user, profile }, transcript] = await Promise.all([getMaterial(id), currentUser(), getTranscript(id)]);
  if (!m && !user) return (
    <div className="wrap page con-gate">
      <h1>This talk is not available</h1>
      <p className="muted">The link may be old or mistyped. If someone shared a private event&apos;s talk with you, sign in with the email address they used and it opens.</p>
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
  // editors of the item (the team, or a private event's members) manage the slides of a recording
  const canEdit = !!user && (m.kind === "talk" || m.kind === "audio")
    && !!(await (await supabaseServer()).rpc("material_editable", { p_material: m.id })).data;
  // the same editors rename the item; videos and slides have no slide editor, so they are asked here
  const canRename = canEdit || (!!user && (m.kind === "video" || m.kind === "slides")
    && !!(await (await supabaseServer()).rpc("material_editable", { p_material: m.id })).data);

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
  const siblings: Material[] = m.events ? await eventMaterials(await supabaseServer(), m.events.id) : [];
  const people = (s: string | null) => (s ?? "").toLowerCase().split(/,|\band\b|&/).map((x) => x.trim()).filter(Boolean);
  const sharesSpeaker = (o: Material) => people(o.speaker).some((p) => people(m.speaker).includes(p));
  const fullSession = isClip(m) ? siblings.find((o) => o.id !== m.id && isWatchable(o) && !isClip(o) && sharesSpeaker(o)) : undefined;
  const clips = !isClip(m) ? siblings.filter((o) => o.id !== m.id && isWatchable(o) && isClip(o) && sharesSpeaker(o)) : [];
  const more = siblings.filter((o) => o.id !== m.id && o.id !== fullSession?.id && isWatchable(o) && !clips.includes(o))
    .sort((a, b) => Number(!sharesSpeaker(a)) - Number(!sharesSpeaker(b)) || byTalkRank(a, b)).slice(0, 3);

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
    </div>
  );
}
