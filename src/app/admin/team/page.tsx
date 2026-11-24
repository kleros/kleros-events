import type { Metadata } from "next";
import { requireTeam } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import NotTeam from "@/components/NotTeam";
import RosterEditor from "@/components/admin/RosterEditor";
import type { TeamMember } from "@/lib/types";

export const metadata: Metadata = { title: "People on event pages" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  // the roster is asked for at the same time as the team check
  const roster = supabaseServer().then((sb) => sb.from("team_members").select("*").eq("active", true).order("sort"));
  const { isTeam } = await requireTeam("/admin/team");
  if (!isTeam) return <NotTeam />;
  const { data } = await roster;
  return (
    <div className="wrap page stack adm-page">
      <header className="adm-head">
        <div>
          <h1>People on event pages</h1>
          <p className="muted">The people who can be listed on event pages. Adding a booking link turns on “Pick a time” for visitors. Changes save when a field loses focus.</p>
        </div>
      </header>
      <RosterEditor initial={(data ?? []) as TeamMember[]} />
    </div>
  );
}
