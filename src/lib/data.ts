import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { supabaseServer, supabaseConfigured } from "./supabase/server";

/**
 * The database as a signed-out visitor sees it: the public key and no session, so no cookie is read.
 * Public pages (home, Events, Talks, People) use it, which lets the host build each of them once and
 * hand the same copy to everyone, instead of building it again on every click.
 */
function visitorDb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Which access a listing reads with: the visitor's own session, or the public view everyone gets. */
export type As = "session" | "public";

// The public lists change a few times a day; they are kept for a minute so pages that show them for
// "You might also like" or counts need no trip to the database (which is in Ireland) on most clicks.
const PUBLIC_TTL = 60;
import type { AgendaItem, EventRow, EventTeamRow, Material } from "./types";

/**
 * Published public events, for the public listings (home, /events, /talks, /me). RLS lets the
 * team read drafts and members read private events too, so filter here; the desk (/admin) runs
 * its own query that includes them, and getEvent opens a draft's or private event's page
 * directly for those who may see it.
 */
export async function listEvents(as: As = "session"): Promise<EventRow[]> {
  if (!supabaseConfigured) return [];
  if (as === "public") return publicEvents();
  return readEvents(await supabaseServer());
}
const publicEvents = unstable_cache(() => readEvents(visitorDb()), ["public-events"], { revalidate: PUBLIC_TTL, tags: ["events"] });
async function readEvents(sb: SupabaseClient): Promise<EventRow[]> {
  const { data, error } = await sb.from("events").select("*").eq("status", "published").eq("visibility", "public").order("starts_on", { ascending: true });
  // an outage must not read as "No events on record yet": app/error.tsx says it plainly instead
  if (error) {
    console.error("listEvents", error.message);
    throw new Error("The events could not be loaded.");
  }
  return (data ?? []) as EventRow[];
}

type Link = { material_id: string; event_id: string };

/**
 * Every material-to-event link the caller can see (0006 material_events), or null when the
 * table is not there yet, in which case callers fall back to materials.event_id.
 */
export async function listLinks(sb: SupabaseClient): Promise<Link[] | null> {
  const { data, error } = await sb.from("material_events").select("material_id, event_id").order("created_at");
  return error ? null : ((data ?? []) as Link[]);
}

/** Fills event_ids on each material: its links, primary event first. */
export function withEventIds<T extends Material>(materials: T[], links: Link[] | null): T[] {
  const by: Record<string, string[]> = {};
  if (links) for (const l of links) (by[l.material_id] ??= []).push(l.event_id);
  return materials.map((m) => {
    const ids = links ? by[m.id] ?? [] : m.event_id ? [m.event_id] : [];
    const ordered = m.event_id && ids.includes(m.event_id) ? [m.event_id, ...ids.filter((x) => x !== m.event_id)] : ids;
    return { ...m, event_ids: ordered };
  });
}

/** The events a material belongs to (event_ids when the helpers filled it, else the primary). */
export const eventIdsOf = (m: Pick<Material, "event_id" | "event_ids">) => m.event_ids ?? (m.event_id ? [m.event_id] : []);

export async function listMaterials(as: As = "session"): Promise<Material[]> {
  if (!supabaseConfigured) return [];
  if (as === "public") return publicMaterials();
  return readMaterials(await supabaseServer());
}
const publicMaterials = unstable_cache(() => readMaterials(visitorDb()), ["public-materials"], { revalidate: PUBLIC_TTL, tags: ["materials"] });
async function readMaterials(sb: SupabaseClient): Promise<Material[]> {
  const [{ data, error }, links] = await Promise.all([
    sb.from("materials").select("*").order("created_at", { ascending: false }),
    listLinks(sb),
  ]);
  if (error) {
    console.error("listMaterials", error.message);
    throw new Error("The talks and files could not be loaded.");
  }
  return withEventIds((data ?? []) as Material[], links);
}

/** YouTube view and like counts per talk (0019 talk_stats, refreshed hourly in the database); {} before 0019 runs. */
export async function talkStats(): Promise<Record<string, { views: number; likes: number | null }>> {
  if (!supabaseConfigured) return {};
  return publicTalkStats();
}
const publicTalkStats = unstable_cache(async () => {
  const sb = visitorDb();
  const { data, error } = await sb.from("talk_stats").select("material_id, views, likes").not("views", "is", null);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [r.material_id as string, { views: Number(r.views), likes: r.likes == null ? null : Number(r.likes) }]));
}, ["talk-stats"], { revalidate: 300 });

/** Talks and files per event, counting every event a material is linked to. */
export function materialCounts(materials: Material[], isTalk: (m: Material) => boolean) {
  const talks: Record<string, number> = {};
  const items: Record<string, number> = {};
  for (const m of materials) {
    for (const id of eventIdsOf(m)) {
      items[id] = (items[id] ?? 0) + 1;
      if (isTalk(m)) talks[id] = (talks[id] ?? 0) + 1;
    }
  }
  return { talks, items };
}

/** Every agenda line that names a speaker, as a visitor sees them (for People profiles). */
export async function agendaSpeakers(): Promise<{ event_id: string; speaker: string }[]> {
  if (!supabaseConfigured) return [];
  return publicAgendaSpeakers();
}
const publicAgendaSpeakers = unstable_cache(async () => {
  const { data } = await visitorDb().from("agenda_items").select("event_id, speaker").not("speaker", "is", null);
  return (data ?? []) as { event_id: string; speaker: string }[];
}, ["agenda-speakers"], { revalidate: 300 });

type Counts = Record<string, { going: number; attended: number }>;
/** Going and attended per event (view event_counts). "public" leaves out private events' totals. */
export async function eventCounts(as: As = "public"): Promise<Counts> {
  if (!supabaseConfigured) return {};
  return as === "public" ? publicEventCounts() : readCounts(await supabaseServer());
}
// the same totals for every visitor; kept for 30 s, as the event pages were
const publicEventCounts = unstable_cache(() => readCounts(visitorDb()), ["event-counts"], { revalidate: 30 });
async function readCounts(sb: SupabaseClient): Promise<Counts> {
  const { data, error } = await sb.from("event_counts").select("*");
  if (error) {
    console.error("eventCounts", error.message);
    throw new Error("The events could not be loaded.");
  }
  return Object.fromEntries((data ?? []).map((r: { event_id: string; going: number; attended: number }) => [r.event_id, { going: r.going, attended: r.attended }]));
}

/** Materials of one event: linked ones (0006), or by materials.event_id before the migration. */
export async function eventMaterials(sb: SupabaseClient, eventId: string): Promise<Material[]> {
  const linked = await sb.from("material_events").select("materials(*)").eq("event_id", eventId);
  let list: Material[];
  if (linked.error) {
    const { data } = await sb.from("materials").select("*").eq("event_id", eventId).order("created_at");
    list = (data ?? []) as Material[];
  } else {
    list = ((linked.data ?? []) as unknown as { materials: Material | null }[]).map((r) => r.materials).filter((m): m is Material => !!m);
  }
  list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!list.length || linked.error) return list.map((m) => ({ ...m, event_ids: m.event_id ? [m.event_id] : [] }));
  const { data: links } = await sb.from("material_events").select("material_id, event_id").in("material_id", list.map((m) => m.id)).order("created_at");
  return withEventIds(list, (links ?? []) as Link[]);
}

/**
 * A published public event by its slug, read with the anon key and no session, so every visitor and every crawler
 * gets the same answer (the share image). Null alike for a draft, a private event and an unknown slug.
 */
export async function getPublicEvent(slug: string): Promise<EventRow | null> {
  if (!supabaseConfigured) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.from("events").select("*").eq("slug", slug).eq("status", "published").eq("visibility", "public").maybeSingle();
  if (error) { console.error("getPublicEvent", error.message); throw new Error("The event could not be loaded."); }
  return (data as EventRow | null) ?? null;
}

/** One event with its agenda, team and materials, read with the visitor's session. Shared by the page and its metadata. */
export const getEvent = cache(async (slug: string) => {
  if (!supabaseConfigured) return null;
  const sb = await supabaseServer();
  const { data: event, error } = await sb.from("events").select("*").eq("slug", slug).maybeSingle();
  // a database failure must not read as "this event does not exist"
  if (error) { console.error("getEvent", error.message); throw new Error("The event could not be loaded."); }
  if (!event) return null;
  const [agenda, team, materials] = await Promise.all([
    sb.from("agenda_items").select("*").eq("event_id", event.id).order("starts_at"),
    sb.from("event_team").select("part, team_members(*)").eq("event_id", event.id),
    eventMaterials(sb, event.id),
  ]);
  return {
    event: event as EventRow,
    agenda: (agenda.data ?? []) as AgendaItem[],
    team: (team.data ?? []) as unknown as EventTeamRow[],
    materials,
  };
});

export type LiveEvent = Pick<EventRow, "id" | "slug" | "title" | "starts_on" | "ends_on" | "venue" | "city" | "status">;

/**
 * The few fields the phone ask page and the big screen need, for any event including drafts
 * (0004 live_event). Falls back to the regular lookup when the function is not there yet.
 */
export async function getLiveEvent(slug: string): Promise<LiveEvent | null> {
  if (!supabaseConfigured) return null;
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("live_event", { p_slug: slug });
  if (!error) return ((data ?? []) as LiveEvent[])[0] ?? null;
  return (await getEvent(slug))?.event ?? null;
}

export type EventRef = Pick<EventRow, "id" | "slug" | "title" | "starts_on" | "ends_on" | "city" | "status" | "visibility">;

/**
 * One material with every event it is linked to that the caller can see (primary first).
 * `events` is the primary event, or the first visible linked one; null for a team-only
 * recording that is not linked to any event yet.
 */
export const getMaterial = cache(async (id: string) => {
  if (!supabaseConfigured) return null;
  const sb = await supabaseServer();
  // materials and events are related twice (event_id, and material_events), so name the key
  const { data, error } = await sb.from("materials").select("*, events!materials_event_id_fkey(id, slug, title, starts_on, ends_on, city, status, visibility)").eq("id", id).maybeSingle();
  // a mistyped address (not a valid id, 22P02) is simply not found; anything else is a failure
  if (error && error.code !== "22P02") { console.error("getMaterial", error.message); throw new Error("The talk could not be loaded."); }
  if (!data) return null;
  const m = data as Material & { events: EventRef | null };
  const linked = await sb.from("material_events").select("event_id, events(id, slug, title, starts_on, ends_on, city, status, visibility)").eq("material_id", id).order("created_at");
  let all: EventRef[] = linked.error
    ? (m.events ? [m.events] : [])
    : ((linked.data ?? []) as unknown as { events: EventRef | null }[]).map((r) => r.events).filter((e): e is EventRef => !!e);
  if (m.events && !all.some((e) => e.id === m.events!.id)) all = [m.events, ...all];
  all.sort((a, b) => (a.id === m.event_id ? -1 : b.id === m.event_id ? 1 : b.starts_on.localeCompare(a.starts_on)));
  return { ...m, events: all[0] ?? null, linkedEvents: all, event_ids: all.map((e) => e.id) };
});
