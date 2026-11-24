import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent } from "@/lib/data";
import { SITE_URL } from "@/lib/kleros";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import HostConsole from "@/components/live/HostConsole";
import SwitchAccount from "@/components/SwitchAccount";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  // getEvent reads with the visitor's own sign-in, so a draft or private event's name shows only to those who may see it
  const data = await getEvent(slug).catch(() => null);
  return data
    ? { title: `Run live: ${data.event.title}`, description: "Questions, big screen and recording", robots: { index: false } }
    : { title: "Run live", robots: { index: false } };
}
export const dynamic = "force-dynamic";

export default async function HostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, profile } = await currentUser();
  const next = encodeURIComponent(`/events/${slug}/host`);
  // the team runs every event; a private event's invited guests run it too
  const data = user ? await getEvent(slug) : null;
  if (user && !data) notFound();
  const canRun = !!data && !!(await (await supabaseServer()).rpc("can_edit_event", { p_event: data.event.id })).data;

  if (!user || !data || !canRun) {
    return (
      <div className="wrap page con-gate">
        <div>
          <div className="eyebrow">Run live</div>
          <p className="muted small" style={{ marginTop: 6 }}>Questions, big screen and recording</p>
        </div>
        <h1>Team or invited people only</h1>
        {user ? (
          <>
            {/* a private event shows only to the team and its guests, so anyone stopped here is signed in without team access */}
            <p>{user.email ? <>Signed in as <b>{user.email}</b>, which does not have team access.</> : "This account does not have team access."}</p>
            <p className="muted">This page runs the questions, the big screen and the recording for an event. It opens for the Kleros team, who use @kleros.io emails, and, on a private event, for the guests added to it.</p>
          </>
        ) : (
          <p className="muted">This page runs the questions, the big screen and the recording for an event. Sign in with a Kleros team account, or, for a private event, with the email address you were added with.</p>
        )}
        <div className="row-flex">
          {user ? <SwitchAccount next={`/events/${slug}/host`} /> : <Link className="btn primary" href={`/login?next=${next}`}>Sign in</Link>}
          <Link className="btn ghost" href={`/events/${slug}`}>Back to the event</Link>
        </div>
      </div>
    );
  }

  const { event, agenda } = data;
  return (
    <HostConsole
      event={{ id: event.id, slug: event.slug, title: event.title, starts_on: event.starts_on, ends_on: event.ends_on, venue: event.venue, city: event.city, status: event.status, visibility: event.visibility }}
      agenda={agenda}
      joinUrl={`${SITE_URL}/q/${slug}`}
      isTeam={!!profile?.is_team}
    />
  );
}
