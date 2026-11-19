import { personBySlug } from "@/lib/people";

/**
 * A team member's profile photo: their current X picture, fetched once and cached by the CDN
 * for a week, so a new picture on X shows up here by itself. 404 when there is none; the
 * page then shows their initials.
 */
const RASTER = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 5_000_000;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const p = personBySlug((await params).slug);
  if (!p?.x) return new Response("No photo", { status: 404 });
  try {
    const r = await fetch(`https://unavatar.io/x/${encodeURIComponent(p.x)}?fallback=false`, { redirect: "follow", cache: "no-store" });
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    // raster pictures only: the answer is served from this site's own origin, where an SVG (or anything a browser
    // would sniff as HTML) opened directly could run script
    if (!r.ok || !RASTER.includes(type) || Number(r.headers.get("content-length") ?? 0) > MAX_BYTES) {
      return new Response("No photo", { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });
    }
    const body = await r.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return new Response("No photo", { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("No photo", { status: 404 });
  }
}
