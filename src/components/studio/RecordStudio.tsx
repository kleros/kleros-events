"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import Recorder, { type RecTarget } from "../live/Recorder";
import LinkEvents from "./LinkEvents";
import EventChip from "./EventChip";
import type { PickEvent } from "@/lib/materials-client";

const free = (): RecTarget => ({ key: `free-${Date.now()}`, agendaId: null, title: "", speaker: "" });

/** /record: record a talk, panel or interview with no event, then link it to events. */
export default function RecordStudio() {
  const [target, setTarget] = useState<RecTarget>(free);
  const onDone = useCallback(() => setTarget(free()), []);

  return (
    <div className="wrap page rs-page">
      <header className="adm-head rs-head">
        <div>
          <h1>Record a session</h1>
          <p className="muted">Record a talk, a panel or an interview without opening an event first. After saving, link it to one or more events, or to a new one. Every recording is also in the recordings library.</p>
        </div>
        <Link className="btn" href="/admin/recordings">Recordings library</Link>
      </header>
      <div className="rs-grid">
        <Recorder eventId={null} target={target} onDone={onDone}
          savedExtra={(id, title) => <SavedLinks key={id} id={id} title={title} />} />
        <aside className="panel rs-side">
          <div className="eyebrow">How it works</div>
          <ol className="rs-steps">
            <li><b>Press Start.</b> Nothing else is needed: the title, speaker and slides can all be added after. Pick <b>Online call</b> to record a Zoom or Meet call in another tab, with the slides it shares.</li>
            <li><b>Review and save.</b> A transcript and notes (summary, key points, action items) start on their own once it is saved.</li>
            <li><b>Link it to events.</b> Pick any events, drafts included, or create a new one. It then shows in the Talks of each.</li>
          </ol>
          <p className="muted small">Until it is linked to a published event, a recording is visible to the Kleros team only.</p>
          <div className="note rs-private">
            <b>Recording a private meeting?</b> For a general assembly or anything only some people should hear, create a private event first and record from its page. The recording then stays with the people you invite.
            <div className="row-flex"><Link className="btn sm" href="/admin/events/new?visibility=private&then=record">Create a private event and record</Link></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Under "Saved": which events the new recording belongs to, and the Link to events dialog. */
function SavedLinks({ id, title }: { id: string; title: string }) {
  const [linked, setLinked] = useState<PickEvent[]>([]);
  return (
    <div className="rs-links">
      <div className="rs-links-h">
        <span className="lbl">Events</span>
        {linked.length
          ? <span className="chips">{linked.map((e) => <EventChip key={e.id} e={e} />)}</span>
          : <span className="muted small">Not linked to an event yet.</span>}
      </div>
      <LinkEvents materialId={id} title={title} linked={linked.map((e) => e.id)} onChange={(_, evs) => setLinked(evs)}
        label={linked.length ? "Change events" : "Link to events"} className={linked.length ? "btn sm" : "btn sm primary"} />
    </div>
  );
}
