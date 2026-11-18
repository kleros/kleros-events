"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError, NO_ACCESS } from "@/lib/friendlyError";
import type { Material } from "@/lib/types";

type Editable = Pick<Material, "id" | "title" | "speaker">;
export type MaterialNames = { title: string; speaker: string | null };

/**
 * Changes the title and speaker of a saved item (a talk, a recording, slides, a link) in place.
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(ev: React.FormEvent) {
    ev.preventDefault(); setErr("");
    const next = { title: title.trim(), speaker: speaker.trim() || null };
    if (!next.title) { setErr("Give it a title first."); return; }
    if (next.title === m.title && next.speaker === (m.speaker || null)) { onCancel(); return; }
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
    <form className="med" onSubmit={save} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} aria-label={`Rename ${m.title}`}>
      <div className="field">
        <label htmlFor={`${id}-t`}>Title</label>
        <input id={`${id}-t`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label htmlFor={`${id}-s`}>Speaker</label>
        <input id={`${id}-s`} value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="Full names, separated by commas" />
      </div>
      <div className="med-acts">
        <button className="btn sm primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button className="btn sm ghost" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
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
