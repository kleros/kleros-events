import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, sessionUser, supabaseServer } from "@/lib/supabase/server";
import MySpace from "@/components/MySpace";
import type { EventRow } from "@/lib/types";

export const metadata: Metadata = { title: "My events", robots: { index: false } };
export const dynamic = "force-dynamic";

/** For the team and for guests added to an internal event: the internal events they can open, and sign out. */
export default async function MePage() {
  // who is signed in comes from the session cookie (no trip); the rest is read in one round
  const me = await sessionUser();
  if (!me) redirect("/login?next=/me");
  const sb = await supabaseServer();
  const [{ user, profile }, priv] = await Promise.all([
    currentUser(),
    // RLS returns private events to the team and to guests added to them
    sb.from("events").select("*").eq("visibility", "private").order("starts_on", { ascending: false }),
  ]);
  if (!user || !profile) redirect("/login?next=/me");
  return <MySpace email={user.email ?? ""} isTeam={!!(profile.is_team || profile.is_admin)} privateEvents={(priv.data ?? []) as EventRow[]} userId={user.id} />;
}
