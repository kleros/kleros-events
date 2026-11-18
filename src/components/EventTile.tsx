"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/** The picture inside the tile, as lib/cover/pick.ts chose it, with its URL ready to load. */
export type TileArt = { src: string; crop?: boolean; position?: string; bg?: string };

/** FNV-1a, the hash GenCover uses, so the same event always gets the same tile. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * An event's tile, the picture on its card, the home page and its own page: the Kleros frame (purple ground with
 * the Kleros symbol large and see-through behind), the Kleros logo and its part at the top, the event's own poster
 * in the middle, and the event's name, dates and place at the bottom. Without a poster, or when the poster's link
 * is broken, the name fills the frame instead. A picture in both themes, so it keeps its own colours.
 */
export default function EventTile({ title, meta, role, art, seed }: {
  title: string; meta: string; role: string; art: TileArt | null; seed: string;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // the poster may have failed before hydration attached onError; check once on mount
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [art?.src]);
  const h = hash(seed);
  // a little variety per event, so a row of tiles doesn't look stamped out: the symbol's turn and place, the glow
  const style = {
    "--kt-rot": `${(h % 31) - 15}deg`,
    "--kt-sx": `${-22 + ((h >> 5) % 13)}%`,
    "--kt-sy": `${-24 + ((h >> 9) % 11)}%`,
    "--kt-gx": `${62 + ((h >> 13) % 34)}%`,
  } as CSSProperties;
  const show = !!art && !failed;
  return (
    <span className={`kt${show ? "" : " noart"}`} style={style} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="kt-sym" src="/kleros-symbol.svg" alt="" />
      <span className="kt-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="kt-logo" src="/kleros-logo.svg" alt="" />
        <span className="kt-role">{role}</span>
      </span>
      {show && (
        <span className="kt-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={ref}
            className={art.crop ? "crop" : undefined}
            src={art.src}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            style={art.position || art.bg ? { objectPosition: art.position, background: art.bg } : undefined}
            onError={() => setFailed(true)}
          />
        </span>
      )}
      <span className="kt-text">
        <span className="kt-title">{title}</span>
        <span className="kt-meta">{meta}</span>
      </span>
    </span>
  );
}
