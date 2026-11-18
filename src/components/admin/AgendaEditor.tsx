"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError, NO_ACCESS } from "@/lib/friendlyError";
import type { AgendaItem } from "@/lib/types";

const byTime = (a: AgendaItem, b: AgendaItem) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "");

export default function AgendaEditor({ eventId, initial }: { eventId: string; initial: AgendaItem[] }) {
  const [items, setItems] = useState(initial);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const fields = (f: FormData) => ({
    starts_at: String(f.get("t") ?? "") || null, title: String(f.get("title") ?? "").trim(),
    speaker: String(f.get("speaker") ?? "").trim() || null, is_kleros: f.get("k") === "on",
  });

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr("");
    const form = e.currentTarget; // React clears currentTarget once the await below starts
    const { data, error } = await supabaseBrowser().from("agenda_items").insert({ event_id: eventId, ...fields(new FormData(form)) }).select("*").single();
    if (error) { setErr(friendlyError(error)); return; }
    setItems((l) => [...l, data as AgendaItem].sort(byTime));
    form.reset();
  }
  async function save(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault(); setErr(""); setBusy(id);
    const { data, error } = await supabaseBrowser().from("agenda_items").update(fields(new FormData(e.currentTarget))).eq("id", id).select("*");
    setBusy("");
    // no row back means the database skipped the change (signed out, or no access to this event)
    if (error || !data?.length) { setErr(error ? friendlyError(error) : NO_ACCESS); return; }
    setItems((l) => l.map((x) => (x.id === id ? (data[0] as AgendaItem) : x)).sort(byTime));
    setEditing("");
  }
  /** Asks once ("Remove?") so a stray click does not delete a session. */
  async function remove(id: string) {
    if (confirm !== id) {
      setConfirm(id);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirm((c) => (c === id ? "" : c)), 4000);
      return;
    }
    setConfirm(""); setErr(""); setBusy(id);
    const sb = supabaseBrowser();
    const { data, error } = await sb.from("agenda_items").delete().eq("id", id).select("id");
    let problem = error ? friendlyError(error) : "";
    if (!problem && !data?.length) {
      // nothing deleted: it may be gone already, or this account cannot change the agenda
      const { data: still } = await sb.from("agenda_items").select("id").eq("id", id);
      if (still?.length) problem = NO_ACCESS;
    }
    setBusy("");
    if (problem) { setErr(problem); return; }
    setItems((l) => l.filter((x) => x.id !== id));
  }

  return (
    <div className="panel">
      <div className="agenda">
        {items.map((a) => editing === a.id ? (
          <form key={a.id} className="ag row-flex" style={{ display: "flex" }} onSubmit={(e) => save(e, a.id)}>
            <input name="t" type="time" aria-label="Time" className="search" style={{ flex: "0 0 120px" }} defaultValue={a.starts_at?.slice(0, 5) ?? ""} />
            <input name="title" required aria-label="Session title" className="search" defaultValue={a.title} autoFocus />
            <input name="speaker" placeholder="Speaker" aria-label="Speaker" className="search" defaultValue={a.speaker ?? ""} />
            <label className="small"><input type="checkbox" name="k" defaultChecked={a.is_kleros} /> Kleros session</label>
            <button className="btn sm primary" type="submit" disabled={busy === a.id}>{busy === a.id ? "Saving…" : "Save"}</button>
            <button className="btn sm ghost" type="button" onClick={() => setEditing("")}>Cancel</button>
          </form>
        ) : (
          <div key={a.id} className="ag" style={{ gridTemplateColumns: "70px minmax(0,1fr) auto" }}>
            <span className="tm">{a.starts_at?.slice(0, 5)}</span>
            <div><div className={a.is_kleros ? "k" : ""} style={{ fontWeight: 600 }}>{a.title}</div>{a.speaker && <div className="muted small">{a.speaker}</div>}</div>
            <div className="row-flex">
              <button className="btn sm ghost" type="button" onClick={() => { setEditing(a.id); setConfirm(""); setErr(""); }}>Edit</button>
              <button className="btn sm ghost" type="button" onClick={() => remove(a.id)} disabled={busy === a.id}
                aria-label={confirm === a.id ? `Confirm removing ${a.title}` : `Remove ${a.title}`}>{confirm === a.id ? "Remove?" : "✕"}</button>
            </div>
          </div>
        ))}
        {!items.length && <div className="muted small">No sessions yet.</div>}
      </div>
      <form className="row-flex" onSubmit={add}>
        <input name="t" type="time" aria-label="Time" className="search" style={{ flex: "0 0 120px" }} />
        <input name="title" required placeholder="Session title" aria-label="Session title" className="search" />
        <input name="speaker" placeholder="Speaker" aria-label="Speaker" className="search" />
        <label className="small"><input type="checkbox" name="k" /> Kleros session</label>
        <button className="btn sm primary" type="submit">Add</button>
      </form>
      {err && <div className="note">{err}</div>}
    </div>
  );
}
