"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendlyError";
import { parseEmails } from "./EventForm";

type Row = { email: string; created_at: string };

/**
 * Guests from outside Kleros who can see and edit a private event (0010 event_collaborators). The
 * whole Kleros team has access already (0021). The team and anyone on the list can add or remove others. Access follows the email: it works once that
 * person signs in with it, Kleros account or not. Nobody is emailed, so the invite message is
 * copied here and sent by hand.
 */
export default function CollaboratorsEditor({ eventId, slug, title, creatorEmail, initial }: {
  eventId: string; slug: string; title: string; creatorEmail: string | null; initial: Row[];
}) {
  const [list, setList] = useState(initial);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // shown to copy by hand when the browser does not allow copying
  const [manual, setManual] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copyInvite() {
    const msg = `You have been added to ${title} on Kleros Events. Open ${window.location.origin}/events/${slug} and sign in with the email address you were added with.`;
    try {
      await navigator.clipboard.writeText(msg);
      setManual(""); setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setManual(msg); }
  }

  async function add(ev: React.FormEvent) {
    ev.preventDefault(); setErr("");
    const { ok, bad } = parseEmails(text);
    if (bad.length) { setErr(`Not an email address: ${bad.join(", ")}`); return; }
    const fresh = ok.filter((e) => e !== creatorEmail && !list.some((r) => r.email === e));
    if (!fresh.length) { setText(""); return; }
    setBusy(true);
    const { data, error } = await supabaseBrowser().from("event_collaborators")
      .insert(fresh.map((email) => ({ event_id: eventId, email }))).select("email, created_at");
    setBusy(false);
    if (error) { setErr(friendlyError(error)); return; }
    setList([...list, ...((data ?? []) as Row[])]);
    setText("");
  }

  async function remove(email: string) {
    setErr("");
    const { error } = await supabaseBrowser().from("event_collaborators").delete().eq("event_id", eventId).eq("email", email);
    if (error) { setErr(friendlyError(error)); return; }
    setList(list.filter((r) => r.email !== email));
  }

  return (
    <div className="panel stack">
      <ul className="collab-list">
        {creatorEmail && <li><span>{creatorEmail}</span><span className="pill plain">Creator</span></li>}
        {list.map((r) => (
          <li key={r.email}>
            <span>{r.email}</span>
            <button className="btn sm ghost" type="button" onClick={() => remove(r.email)} aria-label={`Remove ${r.email}`}>Remove</button>
          </li>
        ))}
        {!list.length && <li className="muted small">No guests yet. Only the Kleros team can see this event.</li>}
      </ul>
      <form className="row-flex" onSubmit={add}>
        <input className="collab-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="partner@example.org" aria-label="Guest emails" />
        <button className="btn" type="submit" disabled={busy || !text.trim()}>{busy ? "Adding…" : "Add"}</button>
      </form>
      {err && <div className="note">{err}</div>}
      <div className="collab-invite">
        <p className="muted small" style={{ margin: 0 }}>The Kleros team already sees this event. Guests added here see it too, with its talks, files and questions, and can edit it, once they sign in with the email listed here. Nobody is notified automatically: copy the invite message and paste it into an email or chat to each person.</p>
        <button className="btn sm" type="button" onClick={copyInvite} aria-live="polite">{copied ? "Copied" : "Copy invite message"}</button>
      </div>
      {manual && (
        <div className="stack">
          <span className="muted small">This browser did not allow copying. Select the message below and copy it.</span>
          <textarea className="collab-msg" readOnly value={manual} rows={3} onFocus={(e) => e.currentTarget.select()} aria-label="Invite message" />
        </div>
      )}
    </div>
  );
}
