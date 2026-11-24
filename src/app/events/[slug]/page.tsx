import type { Metadata } from "next";
import EventView, { eventMetadata } from "@/components/pages/EventView";
import { listEvents } from "@/lib/data";

// The event page as a signed-out visitor sees it, built ahead and kept ready (refreshed every 30 s at most).
// Anyone with a session is sent by the middleware to app/session/events/[slug], built for them.
export const revalidate = 30;

export async function generateStaticParams() {
  return (await listEvents("public")).map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return eventMetadata((await params).slug, "public");
}

export default async function VisitorEventPage({ params }: { params: Promise<{ slug: string }> }) {
  return <EventView slug={(await params).slug} as="public" />;
}
