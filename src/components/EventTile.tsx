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

/** Landscape posters close to the usual 1.91:1 share size fill the picture area; anything else is shown whole. */
const fills = (w: number, h: number) => h > 0 && w / h >= 1.55 && w / h <= 2.4;

/**
 * An event's tile, the picture on its card, the home page and its own page. Two parts, like a ticket:
 * the event's own poster on top, edge to edge at the share-image ratio (1.91:1), and a Kleros band below with
 * Kleros's part, the event's name, dates and place, and the Kleros symbol large and faint at its edge.
 * A poster with another shape (square, tall) is shown whole over a blurred copy of itself, never squeezed into
 * a box. Without a poster, or when its link is broken, the picture area is a plain Kleros ground.
 * A picture in both themes, so it keeps its own colours.
 */
export default function EventTile({ title, meta, role, art, seed }: {
  title: string; meta: string; role: string; art: TileArt | null; seed: string;
}) {
  const [failed, setFailed] = useState(false);
  const [whole, setWhole] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const measure = (img: HTMLImageElement) => {
    if (img.naturalWidth === 0) { setFailed(true); return; }
    setWhole(!art?.crop && !fills(img.naturalWidth, img.naturalHeight));
  };
  // the poster may have loaded (or failed) before hydration attached the handlers; check once on mount
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete) measure(img);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art?.src]);
  const h = hash(seed);
  // a little variety per event, so a row of tiles doesn't look stamped out: the symbol's turn and the glow
  const style = {
    "--kt-rot": `${(h % 25) - 12}deg`,
    "--kt-gx": `${10 + ((h >> 13) % 60)}%`,
  } as CSSProperties;
  const show = !!art && !failed;
  return (
    <span className={`kt${show ? "" : " noart"}`} style={style} aria-hidden>
      <span className="kt-pic">
        {show ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {whole && <img className="kt-blur" src={art.src} alt="" referrerPolicy="no-referrer" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={ref}
              className={`kt-poster${whole ? " whole" : ""}`}
              src={art.src}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              style={art.position || art.bg ? { objectPosition: art.position, background: art.bg } : undefined}
              onLoad={(e) => measure(e.currentTarget)}
              onError={() => setFailed(true)}
            />
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="kt-mark" src="/kleros-logo.svg" alt="" />
          </>
        )}
      </span>
      <span className="kt-band">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="kt-sym" src="/kleros-symbol.svg" alt="" />
        <span className="kt-role">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kleros-symbol.svg" alt="" />
          <span>{role}</span>
        </span>
        <span className="kt-title">{title}</span>
        <span className="kt-meta">{meta}</span>
      </span>
    </span>
  );
}
