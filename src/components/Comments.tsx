"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { notThereYet } from "@/lib/saves";

type Row = { id: string; author_id: string; author_name: string | null; body: string; created_at: string };

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Comments on an event or on one talk (0016 comments). Everyone who can see the page reads them; signed-in
 * visitors write; the author removes their own, and the team (or a private event's members) can remove any.
 * The name shown is the author's display name, set by the database. Hidden until 0016 has run.
 */
export default function Comments({ eventId, materialId, signedIn, canModerate = false, next, displayName }: {
  eventId?: string; materialId?: string; signedIn: boolean; canModerate?: boolean; next: string; displayName?: string | null;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const q = sb.from("comments").select("id, author_id, author_name, body, created_at").order("created_at", { ascending: true }).limit(200);
    const { data, error } = await (eventId ? q.eq("event_id", eventId) : q.eq("material_id", materialId!));
    if (error) { if (notThereYet(error)) setMissing(true); setRows([]); return; }
    setRows((data ?? []) as Row[]);
  }, [eventId, materialId]);

  useEffect(() => {
    load();
    supabaseBrowser().auth.getSession().then(({ data }) => { const u = data.session?.user; setMe(u && !u.is_anonymous ? u.id : null); });
  }, [load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().from("comments").insert(eventId ? { event_id: eventId, body: text } : { material_id: materialId, body: text });
    setBusy(false);
    if (error) { setErr("Your comment did not go through. Check that you are signed in, then try again."); return; }
    setBody(""); load();
  }
  async function remove(id: string) {
    const { error } = await supabaseBrowser().from("comments").delete().eq("id", id);
    if (error) { setErr("That comment could not be removed. Try again in a moment."); return; }
    load();
  }

  if (missing) return null;
  const list = rows ?? [];
  return (
    <div className="comments">
      {rows && list.length === 0 && <p className="quiet-empty">No comments yet.{signedIn ? " Start the conversation." : ""}</p>}
      {list.length > 0 && (
        <ol className="cm-list">
          {list.map((c) => (
            <li key={c.id} className="cm">
              <div className="cm-h">
                <b>{c.author_name || "Visitor"}</b>
                <span className="muted">{when(c.created_at)}</span>
                {(c.author_id === me || canModerate) && (
                  <button type="button" className="link-btn cm-del" onClick={() => remove(c.id)}>{c.author_id === me ? "Delete" : "Remove"}</button>
                )}
              </div>
              <p className="cm-body">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      {signedIn ? (
        <form className="cm-form" onSubmit={post}>
          <label className="sr-only" htmlFor={`cm-${eventId ?? materialId}`}>Your comment</label>
          <textarea id={`cm-${eventId ?? materialId}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3}
            placeholder={materialId ? "What did you think of this talk?" : "Share a thought, a takeaway or a question for others who were there"} />
          <div className="row-flex">
            <button className="btn primary sm" type="submit" disabled={busy || !body.trim()}>{busy ? "Posting…" : "Post comment"}</button>
            {displayName && <span className="muted small">Shown as {displayName}. <Link href="/me">Change</Link></span>}
          </div>
        </form>
      ) : (
        <p className="muted small"><Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link> to comment. Any email works.</p>
      )}
      {err && <div className="note" role="alert">{err}</div>}
    </div>
  );
}
