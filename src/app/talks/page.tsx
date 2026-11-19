import type { Metadata } from "next";
import { eventIdsOf, listEvents, listMaterials, talkStats } from "@/lib/data";
import { latestFirst } from "@/lib/format";
import { mostWatched, statsLine } from "@/lib/popular";
import { TalkCard, isWatchable } from "@/components/MaterialRow";
import TalkArchive from "@/components/TalkArchive";
import SetupNotice from "@/components/SetupNotice";

export const metadata: Metadata = { title: "Talks" };
export const revalidate = 60;

export default async function TalksPage() {
  const [events, materials, stats] = await Promise.all([listEvents(), listMaterials(), talkStats()]);
  // the talks with the most views and likes on YouTube (0019 talk_stats, refreshed hourly), from events on the site
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));
  const shownWith = (m: (typeof materials)[number]) => eventIdsOf(m).map((id) => byId[id]).filter(Boolean).sort(latestFirst)[0];
  const popular = mostWatched(materials.filter((m) => isWatchable(m) && shownWith(m)), stats, 6);
  return (
    <div className="wrap page">
      <SetupNotice />
      <header className="page-head">
        <h1>Talks</h1>
        <p className="lede">Recordings and clips from Kleros events, newest first.</p>
      </header>
      {popular.length >= 3 && (
        <section className="block most-watched" id="most-watched">
          <div className="section-h"><h2>Most watched</h2></div>
          <div className="grid">{popular.map((m) => <TalkCard key={m.id} m={m} event={shownWith(m)} note={statsLine(stats[m.id])} />)}</div>
        </section>
      )}
      <TalkArchive materials={materials} events={events} />
    </div>
  );
}
