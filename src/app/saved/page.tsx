import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { eventIdsOf, listEvents, listMaterials } from "@/lib/data";
import { isPast, latestFirst, plural, soonestFirst } from "@/lib/format";
import EventCard from "@/components/EventCard";
import { LinkList, TalkCard, isWatchable, splitTitle } from "@/components/MaterialRow";
import Related from "@/components/Related";
import { eventProfile, materialProfile, related, startingReads, type Seed } from "@/lib/related";
import type { EventRow } from "@/lib/types";

export const metadata: Metadata = { title: "Saved", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Everything a signed-in visitor kept: events they saved or are going to, and talks, slides and links. */
export default async function SavedPage() {
  const { user } = await currentUser();
  if (!user) redirect("/login?next=/saved");
  const sb = await supabaseServer();
  const [events, materials, att, saves, evSaves] = await Promise.all([
    listEvents(), listMaterials(),
    sb.from("attendance").select("event_id, status").eq("user_id", user.id),
    // the table comes with 0016; before that only events can be saved
    sb.from("material_saves").select("material_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    // saved events on their own (0017); before that, attendance 'saved' says it
    sb.from("event_saves").select("event_id").eq("user_id", user.id),
  ]);
  const byId = Object.fromEntries(events.map((e) => [e.id, e]));
  const status = Object.fromEntries((att.data ?? []).map((a) => [a.event_id as string, a.status as string]));
  const savedEv = new Set((evSaves.data ?? []).map((r) => r.event_id as string));
  const kept = events.filter((e) => status[e.id] || savedEv.has(e.id));
  const ahead = kept.filter((e) => !isPast(e)).sort(soonestFirst);
  const behind = kept.filter(isPast).sort(latestFirst);
  const order = new Map((saves.data ?? []).map((s, i) => [s.material_id as string, i]));
  const mats = materials.filter((m) => order.has(m.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const talks = mats.filter(isWatchable);
  const files = mats.filter((m) => !isWatchable(m));
  const evOf = (m: (typeof mats)[number]) => eventIdsOf(m).map((id) => byId[id]).find(Boolean) as EventRow | undefined;
  const word = (e: EventRow) => status[e.id] === "going" ? "You're going" : status[e.id] === "attended" ? "You were there" : undefined;
  const nothing = !kept.length && !mats.length;

  // "Picked for you": what the saved events and talks have in common, matched against the rest of the site
  // and Kleros's own pages (lib/related.ts, plain rules, no AI). Saving counts more than having been there.
  const seeds: Seed[] = [
    ...kept.map((e) => ({ id: e.id, label: e.title, profile: eventProfile(e), weight: savedEv.has(e.id) || status[e.id] === "going" ? 1 : 0.7 })),
    ...mats.map((m) => ({ id: m.id, label: splitTitle(m.title).main, profile: materialProfile(m, byId) })),
  ];
  const picks = nothing
    ? { talks: [], events: [], reads: startingReads(4) }
    : related(seeds, events, materials, { exclude: new Set(seeds.map((x) => x.id)), talks: 6, events: 3, reads: 5, explain: true });

  return (
    <div className="wrap page">
      <div className="page-head">
        <h1>Saved</h1>
        <p className="lede">{nothing
          ? "Events, talks and slides you save show up here, so you can come back to them."
          : [kept.length && plural(kept.length, "event"), talks.length && plural(talks.length, "talk"), files.length && plural(files.length, "file or link", "files and links")].filter(Boolean).join(" · ")}</p>
      </div>
      {nothing && (
        <p className="quiet-empty">Nothing saved yet. Use <b>Save</b> on an event, or the bookmark on a talk. <Link href="/events">Browse events</Link> or <Link href="/talks">watch the talks</Link>.</p>
      )}
      {ahead.length > 0 && (
        <section className="block">
          <div className="section-h"><h2>Coming up</h2></div>
          <div className="grid">{ahead.map((e) => <EventCard key={e.id} e={e} mine={word(e)} />)}</div>
        </section>
      )}
      {talks.length > 0 && (
        <section className="block">
          <div className="section-h"><h2>Talks</h2></div>
          <div className="grid">{talks.map((m) => <TalkCard key={m.id} m={m} event={evOf(m)} />)}</div>
        </section>
      )}
      {files.length > 0 && (
        <section className="block">
          <div className="section-h"><h2>Slides and links</h2></div>
          <LinkList items={files} first={20} />
        </section>
      )}
      {behind.length > 0 && (
        <section className="block">
          <div className="section-h"><h2>Past events</h2></div>
          <div className="grid">{behind.map((e) => <EventCard key={e.id} e={e} mine={word(e)} />)}</div>
        </section>
      )}
      <Related data={picks} id="picked" title={nothing ? "Start here" : "Picked for you"}
        lede={nothing ? "New to Kleros? These explain how it works." : "Talks, events and Kleros reading related to what you saved. Save more and these get sharper."} />
    </div>
  );
}
