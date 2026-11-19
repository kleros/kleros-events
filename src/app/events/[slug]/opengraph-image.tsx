import { ImageResponse } from "next/og";
import { getPublicEvent } from "@/lib/data";
import { coverImage } from "@/lib/cover/pick";
import { SHARE_SIZE, shareTree, shareFallbackTree } from "@/lib/cover/share";
import { fetchArt } from "@/lib/cover/art";
import { toReact } from "@/lib/cover/react";
import { loadShareFonts } from "@/lib/cover/fonts";

// The picture a link to an event shows on X, LinkedIn, Telegram and the rest, in the look of the event's tile: the
// Kleros frame, Kleros's part, the event's name, dates and place, and its own poster when it can be fetched. Only a
// published public event that is not an example gets one; anything else, private, draft, example or unknown, gets
// the same plain Kleros Events picture, so the image says nothing about whether the event exists and a demo event
// never passes for a real one.
export const runtime = "nodejs";
export const size = { width: SHARE_SIZE.width, height: SHARE_SIZE.height };
export const contentType = "image/png";
// one alt for every image this route makes, so it has to be true of the plain fallback too
export const alt = "Kleros Events";

export default async function Image({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = await params;
  const [event, list] = await Promise.all([getPublicEvent(slug), loadShareFonts()]);
  const shown = event && !event.is_example ? event : null;
  const art = shown ? await fetchArt(coverImage(shown)) : null;
  const tree = shown ? shareTree(shown, art) : shareFallbackTree();
  // next/og marks every image immutable for a year by default, but the address stays the same when the event's
  // title, dates or poster change, or a draft is published, so CDNs keep it for an hour instead
  return new ImageResponse(toReact(tree), {
    ...size,
    fonts: list,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
