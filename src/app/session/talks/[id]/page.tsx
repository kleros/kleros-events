import type { Metadata } from "next";
import TalkView, { talkMetadata } from "@/components/pages/TalkView";

// The talk page for anyone with a session: built for each request with their own access (team tools, private
// events' talks). The middleware sends them here from /talks/<id>; this address itself is not linked. Signed-out
// visitors get the ready-made app/talks/[id].
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return talkMetadata((await params).id, "session");
}

export default async function TalkPage({ params }: { params: Promise<{ id: string }> }) {
  return <TalkView id={(await params).id} as="session" />;
}
