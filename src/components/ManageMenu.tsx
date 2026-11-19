"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import StudioButton from "./studio/StudioButton";

/** About the width of the open panel: used to open it leftwards when it would run off the screen. */
const PANEL_W = 260;

/**
 * The team tools of an event page in one menu: run the event live, record or add materials (which
 * open EventStudio in the Talks section), edit the details, and for the team the recordings library.
 * The page renders it only for people who may edit the event (`canEdit`); `isTeam` adds the library.
 */
export default function ManageMenu({ slug, eventId, isTeam, hasBareRecordings }: {
  slug: string; eventId: string; isTeam: boolean; hasBareRecordings: boolean;
}) {
  const box = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [end, setEnd] = useState(false);

  const close = useCallback((focusSummary: boolean) => {
    const d = box.current;
    if (!d || !d.open) return;
    d.open = false;
    setOpen(false);
    if (focusSummary) d.querySelector("summary")?.focus({ preventScroll: true });
  }, []);

  // closes on a click outside, when the focus moves out, and on Escape (which also gives the focus back to the button)
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: PointerEvent) => { if (!box.current?.contains(ev.target as Node)) close(false); };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") close(true); };
    const onFocus = (ev: FocusEvent) => { if (!box.current?.contains(ev.target as Node)) close(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open, close]);

  // before it opens: on a narrow screen the button can sit near the right edge
  const place = () => {
    const d = box.current;
    if (!d || d.open) return;
    setEnd(d.getBoundingClientRect().left + PANEL_W > document.documentElement.clientWidth - 8);
  };

  return (
    <details ref={box} className={`menu manage${end ? " end" : ""}`} onToggle={(ev) => setOpen(ev.currentTarget.open)}>
      <summary className="btn" onClick={place}>Manage<span className="caret" aria-hidden> ▾</span></summary>
      {/* any item closes the menu; the studio items then open the tools in the Talks section */}
      <div className="menu-panel" onClick={(ev) => { if ((ev.target as HTMLElement).closest("a, button")) close(true); }}>
        <Link href={`/events/${slug}/host`}>Run live</Link>
        <StudioButton mode="record" className="menu-item"><span className="dot" aria-hidden /> Record a session</StudioButton>
        <StudioButton mode="files" className="menu-item">Add files or links</StudioButton>
        {hasBareRecordings && <StudioButton mode="slides" className="menu-item">Attach slides to a recording</StudioButton>}
        <Link href={`/admin/events/${eventId}`}>Edit details</Link>
        {isTeam && <Link href="/admin/recordings">All recordings</Link>}
      </div>
    </details>
  );
}
