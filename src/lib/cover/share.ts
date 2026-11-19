/*
 * The share image (app/events/[slug]/opengraph-image.tsx): the picture X, LinkedIn, Telegram and the rest show for a
 * link to an event, 1200x630, in the look of the event's tile on the site (components/EventTile.tsx). The Kleros
 * frame with the Kleros symbol large and see-through behind, the Kleros Events lockup and Kleros's part, the event's
 * name, dates and place, and its own poster on the right when there is one.
 *
 * Plain { type, props } nodes with inline styles only, for next/og (satori); ./react maps them to React elements.
 * satori has no line-clamp, so titles are broken into lines here with the width tables in ./widths and
 * ./widths-geist, measured from the font files in ./fonts, so every renderer stops at the same word.
 */
import type { EventRow } from "@/lib/types";
import { fmtRange, place } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/kleros";
import { GLYPHS, SERIF as SERIF_ADV } from "./widths";
import { GEIST as GEIST_ADV } from "./widths-geist";
import { LOGO } from "./logo";
import { SYMBOL } from "./symbol";

export type ShareEvent = Pick<EventRow, "slug" | "title" | "city" | "country" | "region" | "starts_on" | "ends_on" | "kleros_role">;
export type CoverChild = CoverNode | string;
export interface CoverNode {
  type: string;
  props: { [key: string]: unknown; children?: CoverChild | CoverChild[] };
}
/** The event's poster, already fetched: a data URL and its size in pixels. */
export type ShareArt = { src: string; width: number; height: number };

export const SHARE_SIZE = { width: 1200, height: 630 } as const;

const INK = "#F7F3FC", META = "#C9C1D6", ROLE = "#DCD0FF";
const SERIF = "Instrument Serif", SANS = "Geist";
const GROUND = "linear-gradient(165deg, #271A42 0%, #18111F 58%, #120D1A 100%)";
const GLOW = "radial-gradient(circle at 88% 0%, rgba(124, 79, 234, 0.38), rgba(124, 79, 234, 0) 60%)";

/* ---------------- type fitting without a DOM ---------------- */

const tables = new Map<string, Map<string, number>>();
function table(adv: string): Map<string, number> {
  let t = tables.get(adv);
  if (!t) {
    t = new Map();
    const chars = Array.from(GLYPHS);
    for (let i = 0; i < chars.length; i++) t.set(chars[i], parseInt(adv.substr(i * 2, 2), 36) / 1000);
    tables.set(adv, t);
  }
  return t;
}
/** Width of s in em, with a little slack for the renderer (kerning is ignored, so this errs wide). */
function em(adv: string, s: string, slack = 1.02): number {
  const t = table(adv);
  let w = 0;
  for (const ch of s) w += t.get(ch) ?? 0.5;
  return w * slack;
}

/** Lines at word boundaries that fit maxW; a word wider than the column is cut by characters. */
function wrap(text: string, maxW: number, width: (s: string) => number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ").filter(Boolean)) {
    const test = cur ? cur + " " + word : word;
    if (width(test) <= maxW) { cur = test; continue; }
    if (cur) lines.push(cur);
    let chars = Array.from(word);
    while (chars.length > 1 && width(chars.join("")) > maxW) {
      let i = chars.length - 1;
      while (i > 1 && width(chars.slice(0, i).join("")) > maxW) i--;
      lines.push(chars.slice(0, i).join(""));
      chars = chars.slice(i);
    }
    cur = chars.join("");
  }
  if (cur) lines.push(cur);
  return lines;
}
const ELLIPSIS = "…";
const untail = (s: string) => s.replace(/[\s,:;.–-]+$/, "");
/** At most maxLines lines, cut at a word with an ellipsis. A long title first loses a trailing "(organiser)". */
function clampLines(text: string, maxW: number, width: (s: string) => number, maxLines: number): string[] {
  let t = text.trim().replace(/\s+/g, " ");
  let lines = wrap(t, maxW, width);
  if (lines.length > maxLines) {
    const shorter = t.replace(/\s*\([^()]*\)$/, "");
    if (shorter && shorter !== t) { t = shorter; lines = wrap(t, maxW, width); }
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines - 1);
  const rest = lines.slice(maxLines - 1).join(" ").split(" ");
  let last = "";
  for (const word of rest) {
    const test = last ? last + " " + word : word;
    if (width(untail(test) + ELLIPSIS) > maxW) break;
    last = test;
  }
  if (!last) {
    const chars = Array.from(rest[0]);
    let i = chars.length;
    while (i > 1 && width(chars.slice(0, i).join("") + ELLIPSIS) > maxW) i--;
    last = chars.slice(0, i).join("");
  }
  return [...kept, untail(last) + ELLIPSIS];
}

/* ---------------- nodes ---------------- */

const el = (type: string, props: Record<string, unknown>, ...children: (CoverChild | null | false)[]): CoverNode => {
  const kids = children.filter((c): c is CoverChild => c !== null && c !== false);
  return { type, props: kids.length ? { ...props, children: kids.length === 1 ? kids[0] : kids } : props };
};
const r1 = (x: number) => Math.round(x * 10) / 10;
/**
 * One line of text. satori measures a word glyph by glyph without kerning but draws it with kerning, so the gap
 * after a long word opens up; with no-break spaces the whole line is one run, drawn kerned at even spacing.
 */
const line = (s: string): CoverNode => el("div", { style: { display: "flex", whiteSpace: "nowrap" } }, s.replace(/ /g, " "));

/** The ground: the gradient, the glow and the Kleros symbol large and see-through, turned a little per event. */
function frame(w: number, h: number, sym: { size: number; right: number; top: number; turn: number; opacity: number }, ...children: (CoverChild | null | false)[]): CoverNode {
  return el("div", { style: { position: "relative", display: "flex", width: w + "px", height: h + "px", overflow: "hidden", backgroundColor: "#120D1A", backgroundImage: `${GLOW}, ${GROUND}` } },
    el("img", { src: SYMBOL, width: sym.size, height: sym.size, alt: "", style: { position: "absolute", right: sym.right + "px", top: sym.top + "px", opacity: sym.opacity, transform: `rotate(${sym.turn}deg)` } }),
    ...children);
}

/** The lockup as the site header draws it: the Kleros logo and "Events" in Instrument Serif. */
function lockup(x: number, y: number, logoH: number): CoverNode {
  return el("div", { style: { position: "absolute", left: r1(x) + "px", top: r1(y) + "px", display: "flex", alignItems: "center" } },
    el("img", { src: LOGO, width: r1((logoH * 959) / 360), height: r1(logoH), alt: "", style: { display: "flex" } }),
    el("div", { style: { display: "flex", fontFamily: SERIF, fontSize: r1(logoH * 0.966) + "px", lineHeight: 1, color: INK, marginLeft: r1(logoH * 0.207) + "px", marginTop: r1(logoH * 0.034) + "px" } }, "Events"));
}

/** FNV-1a, the hash the tile uses, so the symbol turns the same way on the site and in the share image. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The share image for a public event, with its poster when the route could fetch one. */
export function shareTree(e: ShareEvent, art: ShareArt | null): CoverNode {
  const { width: w, height: h } = SHARE_SIZE;
  const m = 72, top = 60, logoH = 44;
  const turn = (hash(e.slug) % 31) - 15;
  // with a poster, the text takes the left column and the poster the right; without one, the text runs wider
  const artBox = { x: 656, y: 128, w: 472, h: 430 };
  const colW = art ? artBox.x - m - 40 : 820;
  const titleSize = art ? 62 : 84, metaSize = 27, roleSize = 18;
  const title = clampLines(e.title || "", colW, (s) => em(SERIF_ADV, s) * titleSize, 3);
  const meta = clampLines(`${fmtRange(e.starts_on, e.ends_on)} · ${place(e)}`, colW, (s) => em(GEIST_ADV, s, 1.05) * metaSize, 2);

  let poster: CoverNode | null = null;
  if (art) {
    const k = Math.min(artBox.w / art.width, artBox.h / art.height);
    const pw = Math.round(art.width * k), ph = Math.round(art.height * k);
    poster = el("img", { src: art.src, width: pw, height: ph, alt: "", style: {
      position: "absolute", left: Math.round(artBox.x + (artBox.w - pw) / 2) + "px", top: Math.round(artBox.y + (artBox.h - ph) / 2) + "px",
      borderRadius: "12px", boxShadow: "0 18px 44px rgba(0, 0, 0, 0.55)", border: "1px solid rgba(255, 255, 255, 0.14)" } });
  }
  return frame(w, h, art ? { size: 820, right: -210, top: -200, turn, opacity: 0.1 } : { size: 900, right: -170, top: -190, turn, opacity: 0.11 },
    lockup(m, top, logoH),
    el("div", { style: {
      position: "absolute", left: m + "px", top: top + logoH + 34 + "px", display: "flex",
      fontFamily: SANS, fontWeight: 500, fontSize: roleSize + "px", lineHeight: 1, letterSpacing: "0.1em", textTransform: "uppercase", color: ROLE,
      padding: "10px 18px", borderRadius: "99px", backgroundColor: "rgba(124, 79, 234, 0.24)", border: "1px solid rgba(196, 181, 253, 0.34)" } },
      ROLE_LABEL[e.kleros_role]),
    poster,
    el("div", { style: { position: "absolute", left: m + "px", bottom: "64px", width: colW + "px", display: "flex", flexDirection: "column" } },
      el("div", { style: { display: "flex", flexDirection: "column", fontFamily: SERIF, fontSize: titleSize + "px", lineHeight: 1.05, letterSpacing: "-0.005em", color: INK } }, ...title.map(line)),
      el("div", { style: { display: "flex", flexDirection: "column", marginTop: "18px", fontFamily: SANS, fontSize: metaSize + "px", lineHeight: 1.3, color: META } }, ...meta.map(line))));
}

/** The share image for a page with no public event behind it: the frame and the lockup, nothing about the event. */
export function shareFallbackTree(): CoverNode {
  const { width: w, height: h } = SHARE_SIZE;
  const logoH = 64;
  return frame(w, h, { size: 900, right: -170, top: -190, turn: -8, opacity: 0.14 }, lockup(80, (h - logoH) / 2, logoH));
}

/** The share image for the site's own pages (home, events, talks, people): the lockup and the site's line. */
export function siteShareTree(): CoverNode {
  const { width: w, height: h } = SHARE_SIZE;
  const m = 80, logoH = 56;
  return frame(w, h, { size: 900, right: -170, top: -190, turn: -8, opacity: 0.14 },
    lockup(m, 92, logoH),
    el("div", { style: { position: "absolute", left: m + "px", bottom: "150px", display: "flex", flexDirection: "column", fontFamily: SERIF, fontSize: "76px", lineHeight: 1.05, color: INK } },
      line("Where Kleros shows up,"),
      el("div", { style: { display: "flex", whiteSpace: "nowrap", color: ROLE } }, "and what was said there.".replace(/ /g, " "))),
    el("div", { style: { position: "absolute", left: m + "px", bottom: "84px", display: "flex", fontFamily: SANS, fontSize: "28px", lineHeight: 1.3, color: META } },
      line("Events, talks, slides and recordings · events.kleros.io")));
}
