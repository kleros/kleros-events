import type { Metadata } from "next";
import Link from "next/link";
import MeetingForm from "@/components/MeetingForm";
import { LUMA_URL } from "@/lib/kleros";

export const metadata: Metadata = {
  title: "Invite Kleros",
  description: "Ask the Kleros team to speak, run a workshop or join a panel at an event.",
};

/** The footer's "Get in touch": a meeting request with no event, which the team reads on the Team desk. */
export default function ContactPage() {
  return (
    <div className="wrap page narrow">
      <div className="eyebrow">Events</div>
      <h1>Invite Kleros to an event</h1>
      <p className="lede">Talks, panels, workshops and juror trainings. Send the details and the Kleros team replies by email.</p>
      <MeetingForm eventId={null} startOpen defaultInterest="Speaking invite" />
      <p className="muted small" style={{ marginTop: 24 }}>
        To meet the team at an event already listed, open it from <Link href="/events">All events</Link> and use Meet Kleros. New events are also posted on <a href={LUMA_URL} target="_blank" rel="noopener">Luma ↗</a>.
      </p>
    </div>
  );
}
