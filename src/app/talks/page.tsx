import type { Metadata } from "next";
import { listEvents, listMaterials } from "@/lib/data";
import TalkArchive from "@/components/TalkArchive";
import SetupNotice from "@/components/SetupNotice";

export const metadata: Metadata = { title: "Talks" };
export const revalidate = 60;

export default async function TalksPage() {
  const [events, materials] = await Promise.all([listEvents(), listMaterials()]);
  return (
    <div className="wrap page">
      <SetupNotice />
      <header className="page-head">
        <h1>Talks</h1>
        <p className="lede">Recordings and clips from Kleros events, newest first.</p>
      </header>
      <TalkArchive materials={materials} events={events} />
    </div>
  );
}
