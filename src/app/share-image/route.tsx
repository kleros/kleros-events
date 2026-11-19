import { ImageResponse } from "next/og";
import { SHARE_SIZE, siteShareTree } from "@/lib/cover/share";
import { toReact } from "@/lib/cover/react";
import { loadShareFonts } from "@/lib/cover/fonts";

// The picture a shared link to the home page, the events list, talks or a person shows on X, LinkedIn, Telegram and
// the rest. Events have their own (events/[slug]/opengraph-image.tsx); talks use their video's picture when there is one.
export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(toReact(siteShareTree()), {
    ...SHARE_SIZE,
    fonts: await loadShareFonts(),
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
