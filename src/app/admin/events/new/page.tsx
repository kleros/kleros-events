import type { Metadata } from "next";
import Link from "next/link";
import { requireTeam } from "@/lib/admin";
import NotTeam from "@/components/NotTeam";
import EventForm from "@/components/admin/EventForm";
import { supabaseServer } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ visibility?: string }> }): Promise<Metadata> {
  return { title: (await searchParams).visibility === "private" ? "Add a private event" : "Add an event" };
}

/**
 * Add an event. ?visibility=private starts with Private chosen; ?then=record opens the recorder
 * on the new event's page after saving; ?from=<event id> copies that event's details (a private
 * copy of a public event).
 */
export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ visibility?: string; then?: string; from?: string }> }) {
  const sp = await searchParams;
  const next = `/admin/events/new${sp.visibility || sp.then || sp.from ? "?" + new URLSearchParams(Object.entries(sp).filter(([, x]) => typeof x === "string") as [string, string][]).toString() : ""}`;
  const { user, isTeam } = await requireTeam(next);
  if (!isTeam) return <NotTeam />;
  const isPrivate = sp.visibility === "private";
  const then = sp.then === "record" ? "record" : undefined;
  let copyOf: EventRow | undefined;
  if (sp.from && /^[0-9a-f-]{36}$/i.test(sp.from)) {
    const { data } = await (await supabaseServer()).from("events").select("*").eq("id", sp.from).maybeSingle();
    if (data) copyOf = { ...(data as EventRow), title: isPrivate ? `${(data as EventRow).title} (private)` : (data as EventRow).title };
  }
  return (
    <div className="wrap page stack adm-page adm-narrow">
      <header className="adm-head">
        <div>
          <Link href="/admin" className="small muted ed-back">← Team desk</Link>
          <h1>{isPrivate ? "Add a private event" : "Add an event"}</h1>
          <p className="muted">{isPrivate
            ? "Only you and the people you add can see a private event, its recordings and its questions. Use it for internal meetings such as a general assembly."
            : "Public events can be saved as a draft to keep them off the site until ready. Private events are only for you and the people you add."}
            {then === "record" ? " After saving, the recorder opens on the new event's page." : " Agenda, team, talks and files can be added after saving."}</p>
        </div>
      </header>
      <EventForm me={{ isTeam, userId: user.id }} initialVisibility={isPrivate ? "private" : undefined} then={then} copyOf={copyOf} />
    </div>
  );
}
