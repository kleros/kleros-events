"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { removeFiles, unlinkMaterial, uploadToStorage } from "@/lib/materials-client";
import { friendlyError } from "@/lib/friendlyError";
import type { EventRow, Material } from "@/lib/types";
import MaterialRow from "../MaterialRow";
import AddMaterials from "./AddMaterials";
import TalkBuilder from "./TalkBuilder";
import MaterialEditor, { editLabel, type MaterialNames } from "./MaterialEditor";

// kept for older imports
export { uploadToStorage };

/** Linked to other events this editor can see: the button then says Unlink (the database also counts events they cannot see). */
const sharedWith = (m: Material, eventId: string) => (m.event_ids ?? []).filter((id) => id !== eventId).length;

export default function MaterialsManager({ event, initial }: { event: EventRow; initial: Material[] }) {
  const [list, setList] = useState(initial);
  const [talkOpen, setTalkOpen] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState("");
  const [editing, setEditing] = useState("");

  async function remove(m: Material) {
    // the first click arms the button; it disarms itself after 4 seconds
    if (confirm !== m.id) { setConfirm(m.id); setTimeout(() => setConfirm((c) => (c === m.id ? "" : c)), 4000); return; }
    setConfirm(""); setErr("");
    const sb = supabaseBrowser();
    // The database decides (0012): it takes the item off this event when it is on other events too,
    // including ones this editor cannot see, and deletes it when this was its last event. Files go
    // after the row, once nothing uses them.
    const { data: paths, error } = await sb.rpc("remove_material_from_event", { p_material: m.id, p_event: event.id });
    let filesGone = true;
    if (error && /remove_material_from_event|schema cache|does not exist/i.test(error.message)) {
      // database not updated to 0012 yet
      if (sharedWith(m, event.id)) {
        try { await unlinkMaterial(m.id, event.id); } catch (e) { setErr(friendlyError(e)); return; }
      } else {
        filesGone = await removeFiles([m.file_path, m.pdf_path, m.audio_path]);
        const { error: delErr } = await sb.from("materials").delete().eq("id", m.id);
        if (delErr) { setErr(friendlyError(delErr)); return; }
      }
    } else if (error) { setErr(friendlyError(error)); return; }
    else filesGone = await removeFiles((paths ?? []) as string[]);
    if (!filesGone) setErr(`"${m.title}" is removed, but its file could not be deleted from storage.`);
    setList(list.filter((x) => x.id !== m.id));
  }
  const added = (m: Material) => setList((l) => [...l, { ...m, event_ids: [event.id] }]);
  const renamed = (id: string, v: MaterialNames) => setList((l) => l.map((x) => (x.id === id ? { ...x, ...v } : x)));

  return (
    <div className="stack">
      <div className="lib">
        {list.map((m) => {
          const shared = sharedWith(m, event.id);
          return (
            <div key={m.id} className="mm-item">
              <div className="row-flex" style={{ flexWrap: "nowrap", alignItems: "stretch" }}>
                <div style={{ flex: 1, minWidth: 0 }}><MaterialRow m={m} /></div>
                <div className="mm-acts">
                  <button className="btn sm ghost" type="button" aria-expanded={editing === m.id}
                    onClick={() => { setConfirm(""); setEditing(editing === m.id ? "" : m.id); }}>{editLabel(m)}</button>
                  <button className={`btn sm ghost${confirm === m.id ? " danger-armed" : ""}`} type="button" onClick={() => remove(m)}
                    title={shared ? `Also linked to ${shared === 1 ? "1 other event" : `${shared} other events`}. It stays there.` : undefined}>
                    {confirm === m.id ? (shared ? "Unlink from this event?" : "Remove for good?") : shared ? "Unlink" : "Remove"}
                  </button>
                </div>
              </div>
              {editing === m.id && <MaterialEditor m={m} onSaved={(v) => renamed(m.id, v)} onCancel={() => setEditing("")} />}
            </div>
          );
        })}
        {!list.length && <div className="muted small">Nothing yet. After the event, add the deck and the recording as a talk.</div>}
      </div>
      <AddMaterials eventId={event.id} onAdded={added}
        extra={<>
          {/* opens the recorder on the event page */}
          <a className="btn primary" href={`/events/${event.slug}#record`}><span className="dot" aria-hidden /> Record a session</a>
          <button className="btn" type="button" style={{ whiteSpace: "normal", textAlign: "left" }} aria-expanded={talkOpen} onClick={() => setTalkOpen(!talkOpen)}>Add a recorded talk (slides + audio file)</button>
        </>} />
      {err && <div className="note">{err}</div>}
      {talkOpen && <TalkBuilder eventId={event.id} slug={event.slug} onSaved={(m) => { added(m); setTalkOpen(false); }} />}
    </div>
  );
}
