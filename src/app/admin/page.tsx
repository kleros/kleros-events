import type { Metadata } from "next";
import Link from "next/link";
import { requireTeam } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtRange, isLive, isPast, place, plural } from "@/lib/format";
import { ROLE_SHORT } from "@/lib/kleros";
import type { EventRow } from "@/lib/types";
import NotTeam from "@/components/NotTeam";
import RequestsTable from "@/components/RequestsTable";
import LumaSync, { type SyncLog } from "@/components/admin/LumaSync";
import DeskSearch from "@/components/admin/DeskSearch";

export const metadata: Metadata = { title: "Team desk" };
export const dynamic = "force-dynamic";

const TABS = ["upcoming", "past", "drafts", "private", "requests"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // the desk's lists are asked for at the same time as the team check (the database shows them only to the team)
  const sb = await supabaseServer();
  const lists0 = Promise.all([
    sb.from("events").select("*").order("starts_on", { ascending: true }),
    sb.from("material_events").select("event_id"),
    sb.from("meeting_requests").select("*, events(title, slug)").order("created_at", { ascending: false }).limit(200),
    sb.from("luma_sync_log").select("ran_at, checked, updated, added, errors").order("ran_at", { ascending: false }).limit(1),
  ]);
  const { isTeam } = await requireTeam();
  if (!isTeam) return <NotTeam />;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "upcoming";
  const [ev, mats, reqs, sync] = await lists0;
  const events = (ev.data ?? []) as EventRow[];
  // links (0006); before that migration, count by materials.event_id
  const linkRows = mats.error ? (await sb.from("materials").select("event_id")).data : mats.data;
  const matCount: Record<string, number> = {};
  for (const m of (linkRows ?? []) as { event_id: string | null }[]) if (m.event_id) matCount[m.event_id] = (matCount[m.event_id] ?? 0) + 1;

  // private events reach this list for the team and their invited guests (RLS, 0021)
  const pub = events.filter((e) => e.visibility !== "private");
  const published = pub.filter((e) => e.status === "published");
  const lists = {
    // private events are never published, so they join the upcoming list by date alone
    upcoming: events.filter((e) => !isPast(e) && (e.status === "published" || e.visibility === "private")),
    past: published.filter((e) => isPast(e)).reverse(),
    drafts: pub.filter((e) => e.status === "draft"),
    private: events.filter((e) => e.visibility === "private"),
  };
  const needsMaterials = lists.past.filter((e) => !matCount[e.id]);
  const requests = reqs.data ?? [];
  const openRequests = requests.filter((r: { handled: boolean }) => !r.handled).length;

  const tabs: { id: Tab; label: string; n: number; hint?: boolean }[] = [
    { id: "upcoming", label: "Upcoming", n: lists.upcoming.length },
    { id: "past", label: "Past", n: lists.past.length, hint: needsMaterials.length > 0 },
    { id: "drafts", label: "Drafts", n: lists.drafts.length },
    { id: "private", label: "Private", n: lists.private.length },
    { id: "requests", label: "Meeting requests", n: openRequests, hint: openRequests > 0 },
  ];

  return (
    <div className="wrap page stack adm-page">
      <header className="adm-head">
        <div>
          <h1>Team desk</h1>
          <p className="muted">Plan events, run them live, and keep talks and slides together afterwards.</p>
        </div>
        <div className="row-flex">
          <Link className="btn primary" href="/admin/events/new">Add event</Link>
          <Link className="btn" href="/admin/events/new?visibility=private">Add private event</Link>
        </div>
      </header>
      <LumaSync last={((sync.data ?? [])[0] as SyncLog | undefined) ?? null} />

      <div className="seg adm-tabs" role="tablist" aria-label="Desk sections">
        {tabs.map((t) => (
          <Link key={t.id} href={t.id === "upcoming" ? "/admin" : `/admin?tab=${t.id}`} role="tab"
            aria-selected={tab === t.id} aria-current={tab === t.id ? "page" : undefined}>
            {t.label} <span className={`adm-count${t.hint ? " hint" : ""}`}>{t.n}</span>
          </Link>
        ))}
      </div>

      {tab === "requests" ? (
        <section className="stack" aria-label="Meeting requests">
          <p className="muted small" style={{ margin: 0 }}>Sent from the “Meet Kleros” box on event pages. Mark a request handled once someone has replied.</p>
          <RequestsTable rows={requests} />
        </section>
      ) : (
        <section className="stack" aria-label={tab}>
          {tab === "past" && needsMaterials.length > 0 && (
            <p className="note" style={{ margin: 0 }}>
              {needsMaterials.length === 1 ? "1 past event has" : `${needsMaterials.length} past events have`} no talks or files yet.
            </p>
          )}
          <EventList events={lists[tab]} tab={tab} matCount={matCount} />
        </section>
      )}
    </div>
  );
}

const EMPTY: Record<Exclude<Tab, "requests">, [string, string]> = {
  upcoming: ["No upcoming events", "Published events and private events with a future date show up here."],
  past: ["No past events yet", "Events move here the day after they end."],
  drafts: ["No drafts", "Events saved as draft stay hidden from the public site until published."],
  private: ["No private events", "Private events are internal: the whole Kleros team sees them, the public does not. Choose Private when adding an event."],
};

function EventList({ events, tab, matCount }: {
  events: EventRow[]; tab: Exclude<Tab, "requests">; matCount: Record<string, number>;
}) {
  if (!events.length) {
    const [title, body] = EMPTY[tab];
    return <div className="empty"><b>{title}</b>{body}</div>;
  }
  return (
    <DeskSearch items={events.map((e) => {
      const mats = matCount[e.id] ?? 0;
      const past = isPast(e);
      return { key: e.id, text: searchText(e), row: (
        <li className="desk-row">
          <div className="desk-date">{fmtRange(e.starts_on, e.ends_on)}</div>
          <div className="desk-main">
            <Link className="desk-title" href={`/admin/events/${e.id}`}>{e.title}</Link>
            <div className="meta">
              <span>{ROLE_SHORT[e.kleros_role]}</span><span aria-hidden>·</span><span>{place(e)}</span>
              {isLive(e) && e.status === "published" && <span className="pill live">Today</span>}
              {e.is_example && <span className="pill ex">Example</span>}
              {e.visibility === "private" && <span className="pill draft">Private</span>}
              {e.status === "published" && looksLikeTest(e.title) && <span className="pill ex">Looks like a test</span>}
            </div>
          </div>
          <div className="desk-stats">
            {past && mats === 0 && e.status === "published"
              ? <span className="pill ex">No talks or files yet</span>
              : (past || mats > 0) && <Count text={plural(mats, "talk or file", "talks and files")} />}
          </div>
          <div className="desk-acts">
            {/* once an event is over, the job left is adding its talks, slides and recordings */}
            {past
              ? <Link className="btn sm" href={`/admin/events/${e.id}#materials`}>Add talks or files</Link>
              : <Link className="btn sm" href={`/events/${e.slug}/host`}>Run live</Link>}
            <Link className="btn sm" href={`/admin/events/${e.id}`}>Edit</Link>
            <Link className="btn sm ghost" href={`/events/${e.slug}`}>View</Link>
          </div>
        </li>
      ) };
    })} />
  );
}

/** A published event that still has a placeholder name ("Test", "Untitled", "asdf"). */
const looksLikeTest = (title: string) => /^(test|untitled|asdf)\b/i.test(title.trim());

/** "3 talks and files" with the number in bold, like the other counts on the row. */
function Count({ text }: { text: string }) {
  const i = text.indexOf(" ");
  return <span><b className="mono">{text.slice(0, i)}</b>{text.slice(i)}</span>;
}

const monthYear = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** What the desk search looks in: title, place, and the date written several ways ("2026-03", "Mar", "March 2026"). */
function searchText(e: EventRow) {
  return [e.title, e.city, e.country, place(e), fmtRange(e.starts_on, e.ends_on), e.starts_on, e.ends_on, monthYear(e.starts_on), e.ends_on && monthYear(e.ends_on)]
    .filter(Boolean).join(" ");
}
