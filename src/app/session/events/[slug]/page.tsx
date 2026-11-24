import type { Metadata } from "next";
import EventView, { eventMetadata } from "@/components/pages/EventView";

// The event page for anyone with a session: built for each request with their own access (private events, team
// tools). The middleware sends them here from /events/<slug>; this address itself is not linked. Signed-out
// visitors get the ready-made app/events/[slug].
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return eventMetadata((await params).slug, "session");
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  return <EventView slug={(await params).slug} as="session" />;
}
