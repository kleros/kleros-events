import type { Metadata } from "next";
import { listEvents, listMaterials } from "@/lib/data";
import TalkArchive from "@/components/TalkArchive";
import SetupNotice from "@/components/SetupNotice";

export const metadata: Metadata = { title: "Talks" };
export const revalidate = 60;

export default async function TalksPage() {
  const [events, materials] = await Promise.all([listEvents(), listMaterials()]);
  return (
    <>
      <div className="page-band"><div className="wrap">
        <SetupNotice />
        <header className="page-head">
          <div className="eyebrow">Talks</div>
          <h1>Talks from Kleros events</h1>
          <p className="lede">Recordings and clips grouped by event, newest first. Choose Everything to add slides, photos and posts.</p>
        </header>
      </div></div>
      <div className="wrap page">
        <TalkArchive materials={materials} events={events} />
      </div>
    </>
  );
}
