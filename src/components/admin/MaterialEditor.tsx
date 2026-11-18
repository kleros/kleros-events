"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError, NO_ACCESS } from "@/lib/friendlyError";
import type { Material, MaterialKind } from "@/lib/types";

/** kind and the file columns are optional: without them (the talk page) only the names can change. */
type Editable = Pick<Material, "id" | "title" | "speaker"> & Partial<Pick<Material, "kind" | "file_path" | "pdf_path" | "audio_path">>;
export type MaterialNames = { title: string; speaker: string | null; kind?: MaterialKind };

/** The types a link or post can have, with the same labels as "Add a link or post" (AddMaterials). */
const LINK_KINDS: [MaterialKind, string][] = [
  ["video", "Video (YouTube, Drive, or a video posted on X)"],
  ["social", "Post without video (X, LinkedIn)"],
  ["link", "Article or link"],
  ["slides", "Slides (Google Slides, Docsend)"],
  ["doc", "Doc"],
];

/** Only a link or post can change type; an uploaded file or a recording keeps the type it was saved with. */
const linkKind = (m: Editable) =>
  m.kind && !m.file_path && !m.pdf_path && !m.audio_path && LINK_KINDS.some(([k]) => k === m.kind) ? m.kind : undefined;

/** What the button that opens the editor says: a link or post can also change type. */
export const editLabel = (m: Editable) => (linkKind(m) ? "Rename or change type" : "Rename");

/**
 * Changes the title and speaker of a saved item (a talk, a recording, slides, a link) in place,
 * and the type of a link or post (an X post that holds a video becomes Video, so it is listed with the talks).
 * The lists that show the item keep their own copy, so they get the new names through onSaved;
 * the page is refreshed for everything else.
 */
export default function MaterialEditor({ m, onSaved, onCancel }: {
  m: Editable; onSaved?: (v: MaterialNames) => void; onCancel: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [title, setTitle] = useState(m.title);
  const [speaker, setSpeaker] = useState(m.speaker ?? "");
  const oldKind = linkKind(m);
  const [kind, setKind] = useState<MaterialKind | undefined>(oldKind);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(ev: React.FormEvent) {
    ev.preventDefault(); setErr("");
    const next: MaterialNames = { title: title.trim(), speaker: speaker.trim() || null, ...(oldKind && kind ? { kind } : {}) };
    if (!next.title) { setErr("Give it a title first."); return; }
    if (next.title === m.title && next.speaker === (m.speaker || null) && (next.kind ?? oldKind) === oldKind) { onCancel(); return; }
    setBusy(true);
    // the database rules decide who may change an item; a refused change comes back as zero rows, not an error
    const { data, error } = await supabaseBrowser().from("materials").update(next).eq("id", m.id).select("id");
    setBusy(false);
    if (error) { setErr(friendlyError(error)); return; }
    if (!data?.length) { setErr(NO_ACCESS); return; }
    onSaved?.(next);
    onCancel();
    router.refresh();
  }

  return (
    <form className={`med${oldKind ? " has-kind" : ""}`} onSubmit={save} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} aria-label={`${editLabel(m)}: ${m.title}`}>
      <div className="field">
        <label htmlFor={`${id}-t`}>Title</label>
        <input id={`${id}-t`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label htmlFor={`${id}-s`}>Speaker</label>
        <input id={`${id}-s`} value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="Full names, separated by commas" />
      </div>
      {oldKind && (
        <div className="field">
          <label htmlFor={`${id}-k`}>Type</label>
          <select id={`${id}-k`} value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)}>
            {LINK_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      )}
      <div className="med-acts">
        <button className="btn sm primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button className="btn sm ghost" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
      {kind === "social" && <span className="muted small med-hint">If the post has a video, choose Video so it is listed with the talks.</span>}
      {err && <div className="note" role="alert">{err}</div>}
    </form>
  );
}

/** A button that opens the editor right below it, for pages that are not a list (the talk page). */
export function MaterialEditButton({ m, label = "Rename" }: { m: Editable; label?: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <MaterialEditor m={m} onCancel={() => setOpen(false)} />;
  return <button className="btn sm" type="button" onClick={() => setOpen(true)}>{label}</button>;
}
