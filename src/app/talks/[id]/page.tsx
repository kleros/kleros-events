import type { Metadata } from "next";
import TalkView, { talkMetadata } from "@/components/pages/TalkView";
import { eventIdsOf, listEvents, listMaterials } from "@/lib/data";

// The talk page as a signed-out visitor sees it, built ahead and kept ready (refreshed every minute at most).
// Anyone with a session is sent by the middleware to app/session/talks/[id], built for them.
export const revalidate = 60;

// every talk of a public event; others are built the first time they are opened
export async function generateStaticParams() {
  const [events, materials] = await Promise.all([listEvents("public"), listMaterials("public")]);
  const shown = new Set(events.map((e) => e.id));
  const pages = new Set(["talk", "slides", "video", "audio"]);
  return materials.filter((m) => pages.has(m.kind) && eventIdsOf(m).some((id) => shown.has(id))).map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return talkMetadata((await params).id, "public");
}

export default async function VisitorTalkPage({ params }: { params: Promise<{ id: string }> }) {
  return <TalkView id={(await params).id} as="public" />;
}
