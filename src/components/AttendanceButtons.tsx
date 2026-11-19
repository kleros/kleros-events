"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { notThereYet } from "@/lib/saves";
import { visitorError } from "@/lib/visitorError";

export const BookmarkIcon = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round">
    <path d="M6 3.5h12a.5.5 0 0 1 .5.5v16.2a.3.3 0 0 1-.48.24L12 16l-6.02 4.44a.3.3 0 0 1-.48-.24V4a.5.5 0 0 1 .5-.5Z" />
  </svg>
);
const CheckIcon = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" fill={on ? "currentColor" : "none"} />
    <path d="m8 12.3 2.6 2.6L16 9.5" style={on ? { stroke: "var(--bg)" } : undefined} />
  </svg>
);
const CalIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

/**
 * An event's own buttons: Save (a bookmark, hollow until saved), I'm going / I was there, and Add to calendar.
 * Save and going are separate, so both can be on (0017 event_saves). Before 0017 runs, Save is the old
 * attendance status 'saved', so it and going replace each other.
 */
export default function AttendanceButtons({ eventId, past, signedIn, slug, calendarUrl }: {
  eventId: string; past: boolean; signedIn: boolean; slug: string; calendarUrl?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<"saved" | "going" | "attended" | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [split, setSplit] = useState(true); // event_saves is there
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    const sb = supabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      const [att, sv] = await Promise.all([
        sb.from("attendance").select("status, note").eq("event_id", eventId).eq("user_id", data.user.id).maybeSingle(),
        sb.from("event_saves").select("event_id").eq("event_id", eventId).eq("user_id", data.user.id).maybeSingle(),
      ]);
      const row = att.data;
      if (row) { setStatus(row.status); setNote(row.note ?? ""); }
      if (sv.error && notThereYet(sv.error)) { setSplit(false); setSaved(row?.status === "saved"); }
      else setSaved(!!sv.data);
    });
  }, [eventId, signedIn]);

  const there = past ? "attended" : "going";
  const isThere = status === there;

  async function writeStatus(next: "saved" | "going" | "attended" | null, nextNote = note) {
    const sb = supabaseBrowser();
    // the row also holds the private notes, so it stays (as 'saved') while there is a note
    const keep = next ?? (nextNote ? "saved" : null);
    const res = keep
      ? await sb.from("attendance").upsert({ user_id: uid, event_id: eventId, status: keep, note: nextNote || null, updated_at: new Date().toISOString() })
      : await sb.from("attendance").delete().eq("user_id", uid!).eq("event_id", eventId);
    if (res.error) { setMsg("Not saved. " + visitorError(res.error, "Saving")); return false; }
    setStatus(keep);
    return true;
  }

  async function toggleSave() {
    if (!uid) return;
    const sb = supabaseBrowser();
    if (!split) {
      // the old way: Save is an attendance status
      if (await writeStatus(saved ? null : "saved")) { setSaved(!saved); if (!saved) setStatus("saved"); setMsg(saved ? "Removed from Saved" : "Saved"); }
      return;
    }
    const res = saved
      ? await sb.from("event_saves").delete().eq("user_id", uid).eq("event_id", eventId)
      : await sb.from("event_saves").insert({ event_id: eventId });
    if (res.error) { setMsg("Not saved. " + visitorError(res.error, "Saving")); return; }
    setSaved(!saved);
    setMsg(saved ? "Removed from Saved" : "Saved");
  }
  async function toggleThere() {
    if (!uid) return;
    if (await writeStatus(isThere ? null : there)) {
      if (!split && !isThere) setSaved(false);
      setMsg(isThere ? "Removed" : past ? "Marked as attended" : "Marked as going");
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row-flex">
        {signedIn ? (
          <>
            <button className={`btn ghost act${saved ? " is-on" : ""}`} aria-pressed={saved} onClick={toggleSave}>
              <BookmarkIcon on={saved} /><span>{saved ? "Saved" : "Save"}</span>
            </button>
            <button className={`btn ghost act${isThere ? " is-on" : ""}`} aria-pressed={isThere} onClick={toggleThere}>
              <CheckIcon on={isThere} /><span>{past ? "I was there" : "I'm going"}</span>
            </button>
          </>
        ) : (
          <Link className="btn ghost act" href={`/login?next=/events/${slug}`}><BookmarkIcon on={false} /><span>Save</span></Link>
        )}
        {!past && calendarUrl && (
          <span className="cal-pair">
            <a className="btn ghost act" href={calendarUrl} target="_blank" rel="noopener"><CalIcon /><span>Add to calendar</span></a>
            <a className="cal-ics" href={`/events/${slug}/calendar.ics`} title="For Apple Calendar or Outlook">.ics</a>
          </span>
        )}
      </div>
      {signedIn && (saved || status) && (
        <div className="field">
          <label htmlFor="ev-note">My private notes</label>
          <textarea id="ev-note" value={note} placeholder="People I met, follow-ups…" onChange={(e) => setNote(e.target.value)} onBlur={() => writeStatus(isThere ? there : status === "saved" || saved ? "saved" : null, note)} />
        </div>
      )}
      {msg && <span className="muted small" role="status">{msg}{(saved || isThere) && msg !== "Removed" ? <> · <Link href="/saved">Open Saved</Link></> : null}</span>}
    </div>
  );
}
