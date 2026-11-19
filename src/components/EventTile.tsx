"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/** The picture inside the tile, as lib/cover/pick.ts chose it, with its URL ready to load. */
export type TileArt = { src: string; crop?: boolean; position?: string; bg?: string; logo?: string };

/** FNV-1a, the hash GenCover uses, so the same event always gets the same tile. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Landscape posters close to the usual 1.91:1 share size fill the picture area; anything else is shown whole. */
const fills = (w: number, h: number) => h > 0 && w / h >= 1.55 && w / h <= 2.4;
const TILE = 1.91;
// how much of the poster's own edge is stretched to fill the tile around it (a sliver, so it carries the
// poster's background colour and texture outwards rather than its text)
const SLIVER = 0.015;

/**
 * An event's tile, the picture on its card, the home page and its own page. Two parts, like a ticket:
 * the event's own poster on top, edge to edge at the share-image ratio (1.91:1), and a Kleros band below with
 * the event's name, dates and place (Kleros's part is said on the event page, not on the tile), and the Kleros symbol large and faint at its edge.
 * A poster with another shape (square, tall, very wide) is shown whole, and its own outer edges are stretched out
 * to fill the rest of the tile (Edges below), never squeezed into
 * a box. Without a poster, or when its link is broken, the picture area is a plain Kleros ground.
 * A picture in both themes, so it keeps its own colours.
 */
export default function EventTile({ title, meta, art, seed }: {
  title: string; meta: string; role?: string; art: TileArt | null; seed: string;
}) {
  const [failed, setFailed] = useState(false);
  const [whole, setWhole] = useState(false);
  const [ratio, setRatio] = useState(0);
  const ref = useRef<HTMLImageElement>(null);
  const measure = (img: HTMLImageElement) => {
    if (img.naturalWidth === 0) { setFailed(true); return; }
    setWhole(!art?.crop && !fills(img.naturalWidth, img.naturalHeight));
    setRatio(img.naturalWidth / img.naturalHeight);
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
            {whole && ratio > 0 && <Edges src={art.src} ratio={ratio} />}
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {art.logo && <img className="kt-logo" src={art.logo} alt="" referrerPolicy="no-referrer" />}
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
        <span className="kt-title">{title}</span>
        <span className="kt-meta">{meta}</span>
      </span>
    </span>
  );
}

/**
 * A poster that is not landscape (or far wider than the tile) fills the rest of the tile with its own edges:
 * the outermost sliver on each side, stretched outwards and softened, so the poster's background carries on
 * to the tile's edges instead of leaving bars. Lengths are in cqw of the tile, which is 100cqw wide.
 */
function Edges({ src, ratio }: { src: string; ratio: number }) {
  const bg = `url("${src.replace(/"/g, "%22")}")`;
  if (ratio < TILE) {
    const side = (1 - ratio / TILE) * 50;                       // each side, in cqw
    const size = `${(side / SLIVER).toFixed(2)}cqw 100%`;
    return (
      <>
        <span className="kt-edge" style={{ left: 0, width: `${side + 0.6}cqw`, backgroundImage: bg, backgroundSize: size, backgroundPosition: "left center" }} />
        <span className="kt-edge" style={{ right: 0, width: `${side + 0.6}cqw`, backgroundImage: bg, backgroundSize: size, backgroundPosition: "right center" }} />
      </>
    );
  }
  const band = (100 / TILE - 100 / ratio) / 2;                   // top and bottom, in cqw
  const size = `100% ${(band / SLIVER).toFixed(2)}cqw`;
  return (
    <>
      <span className="kt-edge" style={{ top: 0, left: 0, right: 0, bottom: "auto", height: `${band + 0.6}cqw`, backgroundImage: bg, backgroundSize: size, backgroundPosition: "center top" }} />
      <span className="kt-edge" style={{ bottom: 0, left: 0, right: 0, top: "auto", height: `${band + 0.6}cqw`, backgroundImage: bg, backgroundSize: size, backgroundPosition: "center bottom" }} />
    </>
  );
}
