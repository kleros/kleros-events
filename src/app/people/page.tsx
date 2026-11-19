import type { Metadata } from "next";
import Link from "next/link";
import { PEOPLE } from "@/lib/people";
import PersonAvatar from "@/components/PersonAvatar";

export const metadata: Metadata = {
  title: "People",
  description: "The Kleros team you meet at events: speakers, business development and the event manager, with their X, LinkedIn and Telegram.",
};

export default function PeoplePage() {
  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>People</h1>
        <p className="lede">The Kleros team you meet at events. Open a profile for their talks and where to reach them.</p>
      </header>
      <div className="people-grid">
        {PEOPLE.map((p) => (
          <Link key={p.slug} className="pcard" href={`/people/${p.slug}`}>
            <PersonAvatar person={p} size={64} />
            <b>{p.name}</b>
            <span className="muted small">{p.role}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
