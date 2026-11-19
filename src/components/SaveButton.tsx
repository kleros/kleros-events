"use client";
import { useState } from "react";
import Link from "next/link";
import { toggleSave, useSaves } from "@/lib/saves";

const Mark = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round">
    <path d="M6 3.5h12a.5.5 0 0 1 .5.5v16.2a.3.3 0 0 1-.48.24L12 16l-6.02 4.44a.3.3 0 0 1-.48-.24V4a.5.5 0 0 1 .5-.5Z" />
  </svg>
);

/**
 * Save a talk, slides or link to the visitor's Saved page. `icon`: a small bookmark for cards and rows, shown
 * only to signed-in visitors. Otherwise a button for the talk page, which offers sign-in to everyone else.
 */
export default function SaveButton({ id, title, icon = false, next }: { id: string; title?: string; icon?: boolean; next?: string }) {
  const s = useSaves();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!s.ready) {
    // signed out (no user) on the talk page: offer sign-in; while loading, or before 0016 runs, nothing
    if (icon || s.user || !next) return null;
    return <Link className="btn ghost save-btn" href={`/login?next=${encodeURIComponent(next)}`}><Mark on={false} /><span>Save</span></Link>;
  }
  const on = s.ids.has(id);
  const click = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setBusy(true);
    const err = await toggleSave(id);
    setBusy(false);
    setMsg(err ?? (on ? "Removed from Saved" : "Saved"));
  };
  const label = on ? "Saved" : "Save";
  if (icon) return (
    <button type="button" className={`save-ico${on ? " on" : ""}`} aria-pressed={on} disabled={busy} onClick={click}
      aria-label={`${on ? "Remove from Saved" : "Save"}${title ? `: ${title}` : ""}`} title={on ? "Saved. Click to remove" : "Save for later"}>
      <Mark on={on} />
    </button>
  );
  return (
    <span className="save-wrap">
      <button type="button" className={`btn ghost save-btn${on ? " on" : ""}`} aria-pressed={on} disabled={busy} onClick={click}>
        <Mark on={on} /><span>{label}</span>
      </button>
      {msg && <span className="muted small" role="status">{msg}{!on ? "" : <> · <Link href="/saved">Open Saved</Link></>}</span>}
    </span>
  );
}
