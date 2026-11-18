import type { MetadataRoute } from "next";
import { listEvents, listMaterials } from "@/lib/data";
import { SITE_URL } from "@/lib/kleros";
import { coverImage } from "@/lib/cover/pick";

// Every public page, for search engines: the listings, each published public event and each talk.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL.replace(/\/$/, "");
  const [events, materials] = await Promise.all([listEvents(), listMaterials()]);
  const publicIds = new Set(events.filter((e) => !e.is_example).map((e) => e.id));
  const day = (s: string | null | undefined) => (s ? new Date(s) : undefined);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/events`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/talks`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/kickback`, changeFrequency: "monthly", priority: 0.4 },
    ...events.filter((e) => !e.is_example).map((e) => {
      // the event's own poster when it has one (lib/cover/pick.ts), never a social-post picture
      const image = coverImage(e);
      return {
        url: `${base}/events/${e.slug}`,
        lastModified: day(e.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
        ...(image ? { images: [image] } : {}),
      };
    }),
    ...materials
      // the materials that have a page of their own (as pageOf in lib/ask/tools.ts)
      .filter((m) => (m.kind === "talk" || m.kind === "video" || ((m.kind === "audio" || m.kind === "slides") && m.file_path))
        && (m.event_ids ?? [m.event_id]).some((id) => id && publicIds.has(id)))
      .map((m) => ({ url: `${base}/talks/${m.id}`, lastModified: day(m.created_at), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
