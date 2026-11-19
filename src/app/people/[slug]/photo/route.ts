import { personBySlug } from "@/lib/people";

/**
 * A team member's profile photo: their current X picture, fetched once and cached by the CDN
 * for a week, so a new picture on X shows up here by itself. 404 when there is none; the
 * page then shows their initials.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const p = personBySlug((await params).slug);
  if (!p?.x) return new Response("No photo", { status: 404 });
  try {
    const r = await fetch(`https://unavatar.io/x/${encodeURIComponent(p.x)}?fallback=false`, { redirect: "follow", cache: "no-store" });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !type.startsWith("image/")) return new Response("No photo", { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });
    return new Response(await r.arrayBuffer(), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("No photo", { status: 404 });
  }
}
