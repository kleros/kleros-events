import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listEvents, listMaterials, eventIdsOf } from "@/lib/data";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { fmtRange, place } from "@/lib/format";
import { peopleIn, personBySlug } from "@/lib/people";
import type { EventRow } from "@/lib/types";
import PersonAvatar from "@/components/PersonAvatar";
import PersonLinks from "@/components/PersonLinks";
import { LinkList, TalkCard, isTalkLike, isWatchable } from "@/components/MaterialRow";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = personBySlug((await params).slug);
  if (!p) return { title: "Not found" };
  return { title: p.name, description: `${p.name}, ${p.role} at Kleros. Talks, events and where to reach them.` };
}

/** Events where the person is on the agenda (agenda_items.speaker), as event ids. */
async function agendaEventIds(slug: string): Promise<string[]> {
  if (!supabaseConfigured) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from("agenda_items").select("event_id, speaker").not("speaker", "is", null);
  return (data ?? []).filter((a) => peopleIn(a.speaker).some((p) => p.slug === slug)).map((a) => a.event_id as string);
}

export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = personBySlug((await params).slug);
  if (!p) notFound();
  const [events, materials, agendaIds] = await Promise.all([listEvents(), listMaterials(), agendaEventIds(p.slug)]);
  // public, published events only, so a private or draft event never shows here
  const byId = new Map(events.filter((e) => !e.is_example).map((e) => [e.id, e]));
  const theirs = materials.filter((m) => peopleIn(m.speaker).some((x) => x.slug === p.slug) && eventIdsOf(m).some((id) => byId.has(id)));
  const eventOf = (ids: string[]) => ids.map((id) => byId.get(id)).find(Boolean);
  const talks = theirs.filter(isTalkLike);
  const files = theirs.filter((m) => !isTalkLike(m));
  const evIds = new Set([...theirs.flatMap(eventIdsOf), ...agendaIds].filter((id) => byId.has(id)));
  const evs = [...evIds].map((id) => byId.get(id)!).sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  const first = p.name.replace(/\(.*?\)/, "").trim().split(" ")[0];

  return (
    <div className="wrap page stack person-page">
      <Link className="back" href="/people">← People</Link>
      <header className="phead">
        <PersonAvatar person={p} size={96} />
        <div>
          <h1>{p.name}</h1>
          <p className="lede">{p.role}, Kleros</p>
          {p.bio && <p className="pbio">{p.bio}</p>}
          <PersonLinks p={p} />
          <p className="small muted pmeet">Want to meet {first} at an event? <Link href="/contact">Send a request</Link> and the team follows up.</p>
        </div>
      </header>

      {talks.length > 0 && (
        <section className="sec">
          <h2>Talks</h2>
          <div className="grid">
            {talks.filter(isWatchable).concat(talks.filter((m) => !isWatchable(m))).map((m) => {
              const e = eventOf(eventIdsOf(m));
              return <TalkCard key={m.id} m={m} event={e} />;
            })}
          </div>
        </section>
      )}

      {evs.length > 0 && (
        <section className="sec">
          <h2>Events</h2>
          <ul className="pevents">
            {evs.map((e: EventRow) => (
              <li key={e.id}>
                <Link href={`/events/${e.slug}`}><b>{e.title}</b></Link>
                <span className="muted small">{[fmtRange(e.starts_on, e.ends_on), place(e)].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {files.length > 0 && (
        <section className="sec">
          <h2>Slides, posts and links</h2>
          <LinkList items={files} />
        </section>
      )}

      {!talks.length && !evs.length && !files.length && (
        <p className="muted">No talks on record yet. Recordings and slides show up here as they are added.</p>
      )}
    </div>
  );
}
