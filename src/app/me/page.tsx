import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, sessionUser, supabaseServer } from "@/lib/supabase/server";
import { listEvents, listMaterials } from "@/lib/data";
import MySpace from "@/components/MySpace";
import type { EventRow, Material } from "@/lib/types";

export const metadata: Metadata = { title: "My events" };
export const dynamic = "force-dynamic";

export default async function MePage() {
  // who is signed in comes from the session cookie (no trip); everything else is read in one round
  const me = await sessionUser();
  if (!me) redirect("/login?next=/me");
  const sb = await supabaseServer();
  const [{ user, profile }, events, publicMaterials, att, prog, priv, evSaves] = await Promise.all([
    currentUser(),
    // the public lists are kept for a minute on the server; talks you are watching come with your progress
    listEvents("public"), listMaterials("public"),
    sb.from("attendance").select("event_id, status, note").eq("user_id", me.id),
    sb.from("talk_progress").select("material_id, position_seconds, finished, materials(*)").eq("user_id", me.id),
    // RLS returns private events to the team and to guests added to them
    sb.from("events").select("*").eq("visibility", "private").order("starts_on", { ascending: false }),
    sb.from("event_saves").select("event_id").eq("user_id", me.id),
  ]);
  if (!user || !profile) redirect("/login?next=/me");
  // a talk you are watching that is not in the public list (a private event's recording) still shows
  const known = new Set(publicMaterials.map((m) => m.id));
  const watched = ((prog.data ?? []) as unknown as { materials: Material | null }[]).map((r) => r.materials)
    .filter((m): m is Material => !!m && !known.has(m.id)).map((m) => ({ ...m, event_ids: m.event_id ? [m.event_id] : [] }));
  const materials = [...publicMaterials, ...watched];
  return <MySpace profile={profile} email={user.email ?? ""} events={events} materials={materials} attendance={att.data ?? []} progress={prog.data ?? []} privateEvents={(priv.data ?? []) as EventRow[]} userId={user.id} savedIds={(evSaves.data ?? []).map((r) => r.event_id as string)} />;
}
