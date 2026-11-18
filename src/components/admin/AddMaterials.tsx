"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { kindOf, uploadToStorage } from "@/lib/materials-client";
import { friendlyError, MAX_UPLOAD_BYTES, tooBigFile } from "@/lib/friendlyError";
import type { Material, MaterialKind } from "@/lib/types";

/** "Talk_slides-final.pdf" becomes "Talk slides final". */
const tidyTitle = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || name;

/** A first guess at the type from the address; the person can still change it. */
function kindFromUrl(raw: string): MaterialKind {
  let host = "", path = "";
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, ""); path = u.pathname;
  } catch { return "link"; }
  const on = (d: string) => host === d || host.endsWith(`.${d}`);
  if (on("youtube.com") || on("youtu.be") || (host === "drive.google.com" && path.startsWith("/file"))) return "video";
  if (on("x.com") || on("twitter.com") || on("linkedin.com")) return "social";
  if ((host === "docs.google.com" && path.startsWith("/presentation")) || host.includes("docsend")) return "slides";
  if (host === "docs.google.com" && path.startsWith("/document")) return "doc";
  return "link";
}

/**
 * Upload files (slides, audio, video, documents, photos) or add a link to an event. Used by
 * the event editor and the team tools on the event page. `extra` renders more buttons in the
 * same row (the event editor puts "Add a talk" there).
 */
export default function AddMaterials({ eventId, onAdded, extra, idPrefix = "am" }: {
  eventId: string; onAdded: (m: Material) => void; extra?: React.ReactNode; idPrefix?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [errs, setErrs] = useState<string[]>([]);
  const [done, setDone] = useState("");
  const [over, setOver] = useState(false);
  const [kind, setKind] = useState<MaterialKind>("link");
  // once the type is picked by hand, a new address no longer changes it
  const [kindPicked, setKindPicked] = useState(false);

  async function addRow(row: Partial<Material>) {
    const { data, error } = await supabaseBrowser().from("materials").insert({ event_id: eventId, ...row }).select("*").single();
    if (error) throw error;
    onAdded(data as Material);
  }
  async function upload(files: File[]) {
    setDone("");
    // files over the limit would fail after a long wait; say so now and upload the rest
    const problems = files.filter((f) => f.size > MAX_UPLOAD_BYTES).map(tooBigFile);
    setErrs(problems);
    let n = 0;
    for (const f of files.filter((x) => x.size <= MAX_UPLOAD_BYTES)) {
      setBusy(`Uploading ${f.name}…`);
      try {
        const path = await uploadToStorage(eventId, f, f.name);
        let pages: number | undefined;
        if (kindOf(f) === "slides") {
          // the page count is a nicety; a PDF the viewer cannot read is still added
          try { const { openPdf } = await import("@/lib/pdf"); pages = (await openPdf(await f.arrayBuffer())).numPages; } catch { pages = undefined; }
        }
        await addRow({ kind: kindOf(f), title: tidyTitle(f.name), file_path: path, size_bytes: f.size, pages });
        n++;
      } catch (e) { problems.push(`${f.name}: ${friendlyError(e)}`); setErrs([...problems]); }
    }
    setBusy("");
    if (n) setDone(n === 1 ? "Added 1 file." : `Added ${n} files.`);
  }
  function closeLink() { setLinkOpen(false); setKind("link"); setKindPicked(false); }
  async function addLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErrs([]); setDone("");
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await addRow({ kind, title: String(f.get("title")).trim(), url: String(f.get("url")).trim(), speaker: String(f.get("speaker")).trim() || null });
      form.reset(); closeLink(); setDone("Link added.");
    } catch (er) { setErrs([friendlyError(er)]); }
  }

  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <div className="stack">
      <div className="row-flex">
        {extra}
        <label className="btn">Upload files<input type="file" multiple className="sr-only" accept=".pdf,image/*,video/*,audio/*,.m4a,.mp3,.doc,.docx,.txt,.md" onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ""; }} /></label>
        <button className="btn" type="button" onClick={() => (linkOpen ? closeLink() : setLinkOpen(true))} aria-expanded={linkOpen}>Add a link or post</button>
      </div>
      <div className={`am-drop${over ? " is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]); }}>
        <span className="muted small">Drop slides (PDF), audio, video, documents or photos here. Export Keynote or PowerPoint decks to PDF first. Each file must stay under 50 MB: put bigger videos on YouTube or Google Drive and add the link.</span>
      </div>
      {busy && <div className="muted small" role="status">{busy}</div>}
      {done && !busy && <div className="ok" role="status">{done}</div>}
      {errs.map((m, i) => <div key={i} className="note">{m}</div>)}
      {linkOpen && (
        <form className="box" onSubmit={addLink}>
          <div className="two">
            <div className="field"><label htmlFor={id("u")}>URL</label><input id={id("u")} name="url" type="url" required placeholder="https://" autoFocus
              onChange={(e) => { if (!kindPicked) setKind(kindFromUrl(e.target.value)); }} /></div>
            <div className="field"><label htmlFor={id("k")}>Type</label>
              <select id={id("k")} name="kind" value={kind} onChange={(e) => { setKind(e.target.value as MaterialKind); setKindPicked(true); }}>
                <option value="video">Video (YouTube, Drive, or a video posted on X)</option>
                <option value="social">Post without video (X, LinkedIn)</option>
                <option value="link">Article or link</option>
                <option value="slides">Slides (Google Slides, Docsend)</option>
                <option value="doc">Doc</option>
              </select>
              {kind === "social" && <span className="muted small">If the post has a video, choose Video so it is listed with the talks.</span>}
            </div>
          </div>
          <div className="two">
            <div className="field"><label htmlFor={id("t")}>Title</label><input id={id("t")} name="title" required placeholder="Panel recording on YouTube" /></div>
            <div className="field"><label htmlFor={id("s")}>Speaker</label><input id={id("s")} name="speaker" placeholder="Full name" /></div>
          </div>
          <div className="row-flex">
            <button className="btn primary sm" type="submit">Add link</button>
            <button className="btn ghost sm" type="button" onClick={closeLink}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
