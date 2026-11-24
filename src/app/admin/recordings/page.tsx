import type { Metadata } from "next";
import { requireTeam } from "@/lib/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { listLinks, withEventIds } from "@/lib/data";
import type { Material } from "@/lib/types";
import type { PickEvent } from "@/lib/materials-client";
import NotTeam from "@/components/NotTeam";
import RecordingsLibrary from "@/components/studio/RecordingsLibrary";

export const metadata: Metadata = { title: "All recordings" };
export const dynamic = "force-dynamic";

export default async function RecordingsPage() {
  // the library is asked for at the same time as the team check (the database shows it only to those allowed)
  const sb = await supabaseServer();
  const lists = Promise.all([
    sb.from("materials").select("*").in("kind", ["talk", "audio", "video"]).order("created_at", { ascending: false }),
    listLinks(sb),
    sb.from("events").select("id, slug, title, starts_on, ends_on, city, country, status, visibility, event_type").order("starts_on", { ascending: false }),
    sb.from("transcripts").select("material_id, status"),
  ]);
  const { isTeam } = await requireTeam("/admin/recordings");
  if (!isTeam) return <NotTeam />;
  const [mats, links, evs, tx] = await lists;
  const materials = withEventIds((mats.data ?? []) as Material[], links);
  const txStatus = Object.fromEntries(((tx.error ? [] : tx.data) ?? []).map((r: { material_id: string; status: string }) => [r.material_id, r.status]));
  return (
    <RecordingsLibrary materials={materials} events={(evs.data ?? []) as PickEvent[]} txStatus={txStatus} linksReady={links !== null} />
  );
}
