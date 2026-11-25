import type { Metadata } from "next";
import { listEvents, listMaterials, materialCounts } from "@/lib/data";
import EventBrowser from "@/components/EventBrowser";
import { isWatchable } from "@/components/MaterialRow";
import SetupNotice from "@/components/SetupNotice";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Events" };
export const revalidate = 60;

// The same page for everyone, built ahead; ?when= and ?view= are read in the browser (EventBrowser).
export default async function EventsPage() {
  const [events, materials] = await Promise.all([listEvents("public"), listMaterials("public")]);
  const { talks, items } = materialCounts(materials, isWatchable);
  return (
    <div className="wrap page">
      <SetupNotice />
      <header className="page-head">
        <h1>Where to find <em>Kleros</em></h1>
        <p className="lede">Conferences, meetups and workshops where Kleros hosts, speaks or has a booth, with the talks and slides from each one.</p>
      </header>
      <EventBrowser events={events} counts={{ talks, materials: items }} initialMonth={todayIso().slice(0, 7)} />
    </div>
  );
}
