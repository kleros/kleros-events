/*
 * The designed Kleros cover, for an event with no official poster (pick.ts decides). Direction A, "place": the
 * city (or "Online") in Instrument Serif, led in by a quiet italic phrase that names the kind of event ("a workshop
 * in"), over a void-violet ground with the Kleros polyhedron: a real icosahedron, the solid the Kleros symbol is
 * drawn from, banded facets with triangular holes, lit like glass.
 *
 *   coverTree(e, { variant: "card" })   4:3, fluid, no other text. Cards, the home hero and the event page header.
 *                                       Text sizes are in cqw against the frame and the SVG scales through its
 *                                       viewBox, so one render fills any width. Styles: .kcover in media.css.
 *   coverTree(e, { variant: "share" })  1200x630 share image, inline styles only, for next/og (satori). Adds the
 *                                       Kleros lockup, the title and "date · role".
 *
 * Pure and deterministic: plain { type, props } nodes (toReact in ./react maps them), no DOM, no measuring, no
 * randomness, no clock. Only + - * / and sqrt (no Math.sin, Math.hypot or Math.pow, which differ between JS
 * engines), so the server and every browser compute the same picture. Type is fitted with the width tables in
 * ./widths, measured from the font files in ./fonts.
 */
import type { EventRow } from "@/lib/types";
import { fmtRange, isOnline } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/kleros";
import { GLYPHS, SERIF as SERIF_ADV, SERIF_ITALIC as SERIF_ITALIC_ADV } from "./widths";
import { GEIST as GEIST_ADV, GEIST_MEDIUM as GEIST_MEDIUM_ADV } from "./widths-geist";
import { LOGO } from "./logo";

export type CoverEvent = Pick<EventRow, "slug" | "title" | "event_type" | "city" | "country" | "region" | "starts_on" | "ends_on" | "kleros_role">;
export type CoverVariant = "card" | "share";
export type CoverChild = CoverNode | string;
export interface CoverNode {
  type: string;
  props: { [key: string]: unknown; children?: CoverChild | CoverChild[] };
}

export const SHARE_SIZE = { width: 1200, height: 630 } as const;

/* ---------------- deterministic variation ---------------- */

/** FNV-1a, the same hash src/components/Cover.tsx uses. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** murmur3's finaliser: FNV hashes of similar slugs start close together, this spreads them out. */
function mix(h: number): number {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
/** mulberry32: a stream of numbers in [0, 1) from one seed, so each choice gets its own draw. */
function stream(seed: number): () => number {
  let a = mix(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

/* ---------------- engine-independent trigonometry ---------------- */

const PI = Math.PI, TAU = 2 * Math.PI, HALF_PI = Math.PI / 2;
/** Sine from its Taylor series on [-pi/2, pi/2] (error under 1e-11): only IEEE arithmetic, same bits everywhere. */
function sin(x: number): number {
  let t = x - TAU * Math.floor((x + PI) / TAU);
  if (t > HALF_PI) t = PI - t;
  else if (t < -HALF_PI) t = -PI - t;
  const q = t * t;
  return t * (1 - (q / 6) * (1 - (q / 20) * (1 - (q / 42) * (1 - (q / 72) * (1 - (q / 110) * (1 - (q / 156) * (1 - q / 210)))))));
}
const cos = (x: number) => sin(x + HALF_PI);

/* ---------------- palette: hex and rgba only, which satori reads ---------------- */

const INK = "#FBF8FF";            // display type, near white
const LAVENDER = "#C4B5FD";       // the italic phrase, highlights
const STROKE = "#A78BFA";         // facet line work
const TITLE = "#ECE7F3";          // the share image's title
const MUTED = "#A79FB8";          // the share image's date and role
const GROUND_TOP = "#24173D", GROUND_MID = "#1A1229", GROUND_END = "#120D1A";
/** The glow's tint, one per event, chosen by the slug: violet, purple, indigo-violet, plum. */
const TINTS = ["#7A4FEA", "#9248D8", "#5F55E6", "#A24FC9"];
/** A tint darkened toward black: k = 1 keeps it, k = 0 is black. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c * k).toString(16).padStart(2, "0")).join("");
}

/* ---------------- words ---------------- */

const trim = (s: string | null | undefined) => (s ?? "").trim();

/** The dominant word: the city, "Online" for online events (isOnline, the rule place() uses), else the country or the region. */
export function placeWord(e: CoverEvent): string {
  if (isOnline(e)) return "Online";
  return trim(e.city) || trim(e.country) || trim(e.region) || "Online";
}

const KIND: Record<string, string> = {
  Conference: "a conference", Meetup: "a meetup", Workshop: "a workshop", Academic: "an academic event",
  Panel: "a panel", "Side event": "a side event", "Online talk / Space": "a talk", Hackathon: "a hackathon",
  "Juror training": "a juror training", Other: "an event",
};
/** The quiet italic phrase that leads into the place: "a workshop in", "a talk," (online). */
export function leadIn(e: CoverEvent): string {
  return (KIND[e.event_type] ?? "an event") + (isOnline(e) ? "," : " in");
}

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
const serifEm = (s: string) => em(SERIF_ADV, s);

/** Break points: after a space (dropped at a line end) or after a hyphen (kept): "Saint-Martin-|de-Belleville". */
function pieces(s: string): { t: string; sep: string }[] {
  const out: { t: string; sep: string }[] = [];
  let cur = "";
  for (const ch of s.trim()) {
    if (/\s/.test(ch)) { if (cur) out.push({ t: cur, sep: " " }); cur = ""; }
    else if (ch === "-" && cur) { out.push({ t: cur + "-", sep: "" }); cur = ""; }
    else cur += ch;
  }
  if (cur) out.push({ t: cur, sep: "" });
  return out;
}
const join = (ps: { t: string; sep: string }[]) => ps.map((p, i) => (i < ps.length - 1 ? p.t + p.sep : p.t)).join("");
/** Every way to cut the pieces into n lines (n <= 3, so this stays tiny). */
function splits(words: { t: string; sep: string }[], n: number): string[][] {
  if (n === 1) return [[join(words)]];
  const out: string[][] = [];
  for (let i = 1; i <= words.length - n + 1; i++) {
    for (const rest of splits(words.slice(i), n - 1)) out.push([join(words.slice(0, i)), ...rest]);
  }
  return out;
}
/**
 * Fit the place: one line at the house size when it fits, else the best-balanced two or three lines, else shrink.
 * caps[n] is the largest size for n + 1 lines, floors[n] the smallest accepted before trying one more line.
 */
function fitPlace(word: string, maxW: number, caps: number[], floors: number[]): { lines: string[]; size: number } {
  const words = pieces(word);
  if (!words.length) return { lines: [word], size: caps[0] };
  let best = { lines: [word], size: caps[0] };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    let pick: { lines: string[]; wMax: number } | null = null;
    for (const lines of splits(words, n)) {
      const wMax = Math.max(...lines.map(serifEm));
      if (!pick || wMax < pick.wMax) pick = { lines, wMax };
    }
    if (!pick) break;
    best = { lines: pick.lines, size: Math.min(caps[n - 1], maxW / pick.wMax) };
    if (best.size >= floors[n - 1]) break;
  }
  return best;
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
const untail = (s: string) => s.replace(/[\s,:;.–—-]+$/, "");
/**
 * At most maxLines lines, cut at a word with an ellipsis. A long title first loses a trailing "(organiser)".
 * Breaking here, rather than with line-clamp, makes Chrome and satori stop at the same word.
 */
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

/* ---------------- the polyhedron ---------------- */

type V2 = [number, number];
type V3 = [number, number, number];
type M3 = [V3, V3, V3];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mul = (M: M3, v: V3): V3 => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
const matmul = (A: M3, B: M3): M3 => {
  const col = (j: number): V3 => [B[0][j], B[1][j], B[2][j]];
  const row = (i: number): V3 => [dot(A[i], col(0)), dot(A[i], col(1)), dot(A[i], col(2))];
  return [row(0), row(1), row(2)];
};
/** Rz * Ry * Rx */
function rotation(ax: number, ay: number, az: number): M3 {
  const ca = cos(ax), sa = sin(ax), cb = cos(ay), sb = sin(ay), cc = cos(az), sc = sin(az);
  return [
    [cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa],
    [sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa],
    [-sb, cb * sa, cb * ca],
  ];
}

const PHI = (1 + Math.sqrt(5)) / 2;
const VERTS: V3[] = ([[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI],
  [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]] as V3[]).map(norm);
const FACES: V3[] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
  [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11],
  [6, 2, 10], [8, 6, 7], [9, 8, 1]];
const EDGES: { a: number; b: number; faces: number[] }[] = (() => {
  const m = new Map<string, { a: number; b: number; faces: number[] }>();
  FACES.forEach((f, fi) => {
    for (let k = 0; k < 3; k++) {
      const a = Math.min(f[k], f[(k + 1) % 3]), b = Math.max(f[k], f[(k + 1) % 3]), key = a + "-" + b;
      if (!m.has(key)) m.set(key, { a, b, faces: [] });
      m.get(key)!.faces.push(fi);
    }
  });
  return Array.from(m.values());
})();

interface Face { i: number; f: V3; n: V3; front: boolean; depth: number; c: V2; P: [V2, V2, V2] }
interface Solid { P2: V2[]; faces: Face[]; cx: number; cy: number; R: number }

/** Project the icosahedron with a little perspective; per face, whether it faces the viewer. */
function project(M: M3, cx: number, cy: number, R: number): Solid {
  const D = 5.2;                                  // camera distance in radii
  const P3 = VERTS.map((v) => mul(M, v));
  const P2 = P3.map((p): V2 => { const s = D / (D - p[2]); return [cx + p[0] * R * s, cy - p[1] * R * s]; });
  const faces = FACES.map((f, i): Face => {
    const a = P3[f[0]], b = P3[f[1]], c = P3[f[2]];
    let n = norm(cross(sub(b, a), sub(c, a)));
    const ctr: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (dot(n, ctr) < 0) n = scale(n, -1);       // outward
    const P: [V2, V2, V2] = [P2[f[0]], P2[f[1]], P2[f[2]]];
    return { i, f, n, front: dot(n, sub([0, 0, D], ctr)) > 0, depth: ctr[2], c: [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3], P };
  });
  return { P2, faces, cx, cy, R };
}

/* ---------------- keeping the light out of the type ---------------- */

interface Rect { x0: number; y0: number; x1: number; y1: number }
const inRect = (p: V2, r: Rect) => p[0] >= r.x0 && p[0] <= r.x1 && p[1] >= r.y0 && p[1] <= r.y1;
const orient = (a: V2, b: V2, c: V2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function inTri(p: V2, [a, b, c]: [V2, V2, V2]): boolean {
  const d1 = orient(a, b, p), d2 = orient(b, c, p), d3 = orient(c, a, p);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
/** The part of segment ab inside box r, as [t0, t1] along it, or null (Liang-Barsky). */
function clipSpan(a: V2, b: V2, r: Rect): [number, number] | null {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const ps = [-dx, dx, -dy, dy], qs = [a[0] - r.x0, r.x1 - a[0], a[1] - r.y0, r.y1 - a[1]];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (ps[i] === 0) { if (qs[i] < 0) return null; continue; }
    const t = qs[i] / ps[i];
    if (ps[i] < 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t;
  }
  return t0 < t1 ? [t0, t1] : null;
}
const crosses = (a: V2, b: V2, c: V2, d: V2) =>
  orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
/** Whether a projected facet touches a text box. */
function hits(P: [V2, V2, V2], r: Rect): boolean {
  if (P.some((p) => inRect(p, r))) return true;
  const corners: V2[] = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
  if (corners.some((q) => inTri(q, P))) return true;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) if (crosses(P[i], P[(i + 1) % 3], corners[j], corners[(j + 1) % 4])) return true;
  }
  return false;
}

/* ---------------- composition ---------------- */

interface Spot { x: V2; y: V2; r: V2 }
// where the solid sits, as fractions of the width (x) and height (y, r), always away from the type's corner
const CARD_SPOTS: Spot[] = [
  { x: [0.70, 0.80], y: [0.30, 0.42], r: [0.52, 0.62] },   // close, cut by the right edge
  { x: [0.66, 0.76], y: [0.14, 0.24], r: [0.56, 0.66] },   // close, cut by the top
  { x: [0.42, 0.60], y: [0.04, 0.12], r: [0.50, 0.58] },   // hanging from the top
  { x: [0.54, 0.78], y: [0.32, 0.40], r: [0.26, 0.36] },   // far: small and whole (a whole icosahedron looks
                                                            // alike at any turn, so place and size do the varying)
];
const CARD_WEIGHTS = [0.28, 0.24, 0.24, 0.24];
const SHARE_SPOTS: Spot[] = [
  { x: [0.78, 0.82], y: [0.46, 0.54], r: [0.50, 0.56] },   // whole, right of the type
  { x: [0.84, 0.88], y: [0.42, 0.56], r: [0.58, 0.64] },   // cut by the right edge
  { x: [0.77, 0.81], y: [0.34, 0.40], r: [0.54, 0.60] },   // cut by the top
];
const SHARE_WEIGHTS = [0.4, 0.3, 0.3];

interface Variation { M: M3; tint: string; light: V3; washX: number; cx: number; cy: number; r: number }

/**
 * Every choice comes from the slug, never from the place, so two events in one city never share a picture: the
 * solid's rotation, its tint, the light, the placement and the size. The draws that both variants use come first,
 * so an event's card and share image turn the solid the same way and share a tint.
 */
function variation(slug: string, variant: CoverVariant): Variation {
  const R = stream(hash(slug || "kleros"));
  const ax = R() * TAU, ay = R() * TAU, az = R() * TAU;
  const sign = R() < 0.5 ? -1 : 1;
  const turn = (sign * lerp(18, 50, R()) * PI) / 180;
  const tint = TINTS[Math.min(TINTS.length - 1, Math.floor(R() * TINTS.length))];
  const light = norm([lerp(-0.8, 0.8, R()), lerp(0.5, 0.95, R()), lerp(0.45, 0.8, R())]);
  const washX = lerp(0.05, 0.4, R());
  const spots = variant === "share" ? SHARE_SPOTS : CARD_SPOTS;
  const weights = variant === "share" ? SHARE_WEIGHTS : CARD_WEIGHTS;
  let pick = R(), i = 0;
  while (i < weights.length - 1 && pick > weights[i]) { pick -= weights[i]; i++; }
  const s = spots[i];
  return {
    M: matmul(rotation(0, 0, turn), rotation(ax, ay, az)), tint, light, washX,
    cx: lerp(s.x[0], s.x[1], R()), cy: lerp(s.y[0], s.y[1], R()), r: lerp(s.r[0], s.r[1], R()),
  };
}

const el = (type: string, props: Record<string, unknown>, ...children: (CoverChild | null | false)[]): CoverNode => {
  const kids = children.filter((c): c is CoverChild => c !== null && c !== false);
  return { type, props: kids.length ? { ...props, children: kids.length === 1 ? kids[0] : kids } : props };
};
const pt = (p: V2) => r1(p[0]) + "," + r1(p[1]);
const tri = (P: V2[]) => "M" + pt(P[0]) + "L" + pt(P[1]) + "L" + pt(P[2]) + "Z";
function inset(P: V2[], k: number): V2[] {
  const c: V2 = [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3];
  return P.map((p): V2 => [lerp(p[0], c[0], k), lerp(p[1], c[1], k)]);
}

/**
 * The ground, one inline SVG: void gradient, a soft glow, a deeper pool, the solid, a scrim on the type's side.
 * The lit facet is the best-lit front facet that is on the frame and clear of every text box; the light is then
 * turned toward it and facets behind the type are dimmed, so the brightest part of the solid sits in the open.
 */
function ground(o: { w: number; h: number; uid: string; v: Variation; sol: Solid; online: boolean; text: Rect[]; ink?: Rect[]; wide: boolean }): CoverNode {
  const { w, h, uid, v, sol, online, text, wide } = o;
  const ink = o.ink ?? text;                      // the boxes of the type itself, line by line where known
  const { P2, faces } = sol;
  const px = Math.max(1, w / 360);               // line weight follows the frame, 1px at card size
  const id = (k: string) => uid + k;
  const behind = (fc: Face) => text.some((r) => hits(fc.P, r));
  const onFrame = (fc: Face) => fc.c[0] > w * 0.04 && fc.c[0] < w * 0.96 && fc.c[1] > h * 0.04 && fc.c[1] < h * 0.96;

  const front = faces.filter((fc) => fc.front).sort((a, b) => a.depth - b.depth);
  const open = front.filter((fc) => onFrame(fc) && !behind(fc));
  const lit = open.length ? open.reduce((m, fc) => (dot(fc.n, v.light) > dot(m.n, v.light) ? fc : m), open[0]) : null;
  // three parts the lit facet's normal to one part the event's light: the lit facet stays the brightest
  const L = lit ? norm(add(scale(lit.n, 3), v.light)) : v.light;
  const glow: V2 = lit && !text.some((r) => inRect([lerp(sol.cx, lit.c[0], 0.5), lerp(sol.cy, lit.c[1], 0.5)], r))
    ? [lerp(sol.cx, lit.c[0], 0.5), lerp(sol.cy, lit.c[1], 0.5)] : [sol.cx, sol.cy];

  const defs = el("defs", {},
    el("linearGradient", { id: id("b"), x1: "0", y1: "0", x2: "0.45", y2: "1" },
      el("stop", { offset: "0", stopColor: GROUND_TOP }),
      el("stop", { offset: "0.5", stopColor: GROUND_MID }),
      el("stop", { offset: "1", stopColor: GROUND_END })),
    // a soft light behind the solid, in the event's tint
    el("radialGradient", { id: id("g"), cx: r1(glow[0]), cy: r1(glow[1]), r: r1(Math.max(sol.R * 1.5, h * 0.7)), gradientUnits: "userSpaceOnUse" },
      el("stop", { offset: "0", stopColor: v.tint, stopOpacity: 0.42 }),
      el("stop", { offset: "0.55", stopColor: shade(v.tint, 0.6), stopOpacity: 0.14 }),
      el("stop", { offset: "1", stopColor: shade(v.tint, 0.35), stopOpacity: 0 })),
    // a second, deeper pool low in the frame
    el("radialGradient", { id: id("p"), cx: r1(v.washX * w), cy: r1(h * 1.05), r: r1(Math.max(w, h) * 0.75), gradientUnits: "userSpaceOnUse" },
      el("stop", { offset: "0", stopColor: shade(v.tint, 0.5), stopOpacity: 0.34 }),
      el("stop", { offset: "1", stopColor: shade(v.tint, 0.3), stopOpacity: 0 })),
    // the scrim that keeps the type's side quiet
    wide
      ? el("linearGradient", { id: id("s"), x1: "0", y1: "0", x2: "1", y2: "0" },
          el("stop", { offset: "0", stopColor: GROUND_END, stopOpacity: 0.85 }),
          el("stop", { offset: "0.45", stopColor: GROUND_END, stopOpacity: 0.6 }),
          el("stop", { offset: "0.74", stopColor: GROUND_END, stopOpacity: 0 }))
      : el("linearGradient", { id: id("s"), x1: "0", y1: "1", x2: "0", y2: "0" },
          el("stop", { offset: "0", stopColor: GROUND_END, stopOpacity: 0.8 }),
          el("stop", { offset: "0.3", stopColor: GROUND_END, stopOpacity: 0.5 }),
          el("stop", { offset: "0.62", stopColor: GROUND_END, stopOpacity: 0 })),
    // the one lit facet
    el("linearGradient", { id: id("l"), x1: "0", y1: "0", x2: "1", y2: "1" },
      el("stop", { offset: "0", stopColor: LAVENDER, stopOpacity: 0.6 }),
      el("stop", { offset: "1", stopColor: STROKE, stopOpacity: 0.12 })));

  const layers: CoverNode[] = [
    el("rect", { width: w, height: h, fill: `url(#${id("b")})` }),
    el("rect", { width: w, height: h, fill: `url(#${id("g")})` }),
    el("rect", { width: w, height: h, fill: `url(#${id("p")})` }),
  ];
  const edgeD = (list: typeof EDGES) => list.map((ed) => "M" + pt(P2[ed.a]) + "L" + pt(P2[ed.b])).join("");
  /** The edges as two paths: the parts clear of the type, and the parts that run through it. */
  const splitD = (list: typeof EDGES): [string, string] => {
    let out = "", through = "";
    for (const ed of list) {
      const a = P2[ed.a], b = P2[ed.b];
      const at = (t: number): V2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      const seg = (t0: number, t1: number) => "M" + pt(at(t0)) + "L" + pt(at(t1));
      const spans = ink.map((r) => clipSpan(a, b, r)).filter((x): x is [number, number] => x !== null).sort((x, y) => x[0] - y[0]);
      let t = 0;
      for (const [t0, t1] of spans) {
        if (t1 <= t) continue;
        if (t0 > t) out += seg(t, t0);
        through += seg(Math.max(t, t0), t1);
        t = t1;
      }
      if (t < 1) out += seg(t, 1);
    }
    return [out, through];
  };

  // hidden edges: faint, so the solid reads as glass rather than a flat badge
  const back = EDGES.filter((ed) => ed.faces.every((fi) => !faces[fi].front));
  layers.push(el("path", { d: edgeD(back), fill: "none", stroke: STROKE, strokeOpacity: online ? 0.3 : 0.16, strokeWidth: r2(px * 0.8) }));

  if (!online) {
    // each facet is a band around a triangular hole, the way the Kleros symbol is drawn
    for (const fc of front) {
      const l = Math.max(0, dot(fc.n, L));
      let a = 0.05 + 0.3 * l * Math.sqrt(l);
      if (behind(fc)) a = 0.05 + (a - 0.05) * 0.3;
      layers.push(el("path", { d: tri(fc.P) + tri(inset(fc.P, 0.27)), fillRule: "evenodd", fill: STROKE, fillOpacity: r2(a) }));
    }
    if (lit) layers.push(el("path", { d: tri(lit.P) + tri(inset(lit.P, 0.27)), fillRule: "evenodd", fill: `url(#${id("l")})` }));
    layers.push(el("path", { d: front.map((fc) => tri(inset(fc.P, 0.27))).join(""), fill: "none", stroke: LAVENDER, strokeOpacity: 0.16, strokeWidth: r2(px * 0.75) }));
  }
  // visible edges, the outline a little stronger than the inner ones. Where a line or a vertex point runs through
  // the type it drops to the share of its strength that facets behind the type keep (DIM), so no strong line
  // crosses a word.
  const DIM = 0.3;
  const vis = EDGES.filter((ed) => ed.faces.some((fi) => faces[fi].front));
  const rim = vis.filter((ed) => ed.faces.some((fi) => !faces[fi].front));
  const inner = vis.filter((ed) => ed.faces.every((fi) => faces[fi].front));
  const innerA = 0.5, rimA = online ? 0.55 : 0.72, dotA = online ? 0.85 : 0.6;
  const [innerOut, innerIn] = splitD(inner), [rimOut, rimIn] = splitD(rim);
  layers.push(el("path", { d: innerOut, fill: "none", stroke: STROKE, strokeOpacity: innerA, strokeWidth: r2(px), strokeLinejoin: "round" }));
  layers.push(el("path", { d: rimOut, fill: "none", stroke: LAVENDER, strokeOpacity: rimA, strokeWidth: r2(px * 1.1), strokeLinejoin: "round" }));
  if (innerIn) layers.push(el("path", { d: innerIn, fill: "none", stroke: STROKE, strokeOpacity: r2(innerA * DIM), strokeWidth: r2(px) }));
  if (rimIn) layers.push(el("path", { d: rimIn, fill: "none", stroke: LAVENDER, strokeOpacity: r2(rimA * DIM), strokeWidth: r2(px * 1.1) }));
  // the vertices as points: for online events, a see-through wireframe, they carry the picture
  const shown = new Set<number>();
  (online ? faces : front).forEach((fc) => fc.f.forEach((k) => shown.add(k)));
  const dotR = r2(px * (online ? 1.6 : 1.2));
  const dotsD = (ks: number[]) => ks.map((k) => {
    const [x, y] = P2[k];
    return `M${r1(x - dotR)},${r1(y)}a${dotR},${dotR} 0 1,0 ${r2(dotR * 2)},0a${dotR},${dotR} 0 1,0 ${-r2(dotR * 2)},0Z`;
  }).join("");
  const points = Array.from(shown).sort((a, b) => a - b);
  const inType = (k: number) => ink.some((r) => inRect(P2[k], r));
  layers.push(el("path", { d: dotsD(points.filter((k) => !inType(k))), fill: LAVENDER, fillOpacity: dotA }));
  const dimPoints = points.filter(inType);
  if (dimPoints.length) layers.push(el("path", { d: dotsD(dimPoints), fill: LAVENDER, fillOpacity: r2(dotA * DIM) }));
  layers.push(el("rect", { width: w, height: h, fill: `url(#${id("s")})` }));

  return el("svg", wide
    ? { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: { position: "absolute", left: 0, top: 0 } }
    : { width: "100%", height: "100%", viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "xMidYMid slice", focusable: "false" },
  defs, ...layers);
}

/** Gradient ids unique per event and variant, so two covers on one page never share one. */
const uidOf = (e: CoverEvent, variant: CoverVariant) => "kc" + hash((e.slug || "") + ":" + variant).toString(36);

/* ---------------- the card: 4:3, fluid, the place and its lead-in ---------------- */

function card(e: CoverEvent): CoverNode {
  const w = 400, h = 300;                        // proportions only: sizes are emitted in cqw
  const cq = (px: number) => r2((px / w) * 100) + "cqw";
  const word = placeWord(e), lead = leadIn(e);
  const m = w * 0.075, bottom = h * 0.085, leadSize = w * 0.054;
  const fit = fitPlace(word, w - 2 * m, [w * 0.135, w * 0.118, w * 0.1], [w * 0.112, w * 0.092, 0]);
  // the text box, as .kcover-text in media.css lays it out, padded a little
  const textW = Math.max(...fit.lines.map((l) => serifEm(l) * fit.size), em(SERIF_ITALIC_ADV, lead) * leadSize);
  const textH = fit.lines.length * fit.size * 1.02 + leadSize * 1.2 + w * 0.006;
  const pad = w * 0.03;
  const text: Rect = { x0: m - pad, y0: h - bottom - textH - pad, x1: m + textW + pad, y1: h };
  // each line's own box (lead-in, then the place lines from the bottom margin up), padded a little, for the lines
  const lineH = fit.size * 1.02, placeTop = h - bottom - fit.lines.length * lineH, leadBottom = placeTop - w * 0.006;
  const ip = w * 0.012;
  const ink: Rect[] = [
    { x0: m - ip, y0: leadBottom - leadSize * 1.2 - ip, x1: m + em(SERIF_ITALIC_ADV, lead) * leadSize + ip, y1: leadBottom + ip },
    ...fit.lines.map((l, i): Rect => ({ x0: m - ip, y0: placeTop + i * lineH - ip, x1: m + serifEm(l) * fit.size + ip, y1: placeTop + (i + 1) * lineH + ip })),
  ];
  const v = variation(e.slug, "card");
  const sol = project(v.M, v.cx * w, v.cy * h, v.r * h);
  return el("div", { className: "kcover", "aria-hidden": "true" },
    ground({ w, h, uid: uidOf(e, "card"), v, sol, online: isOnline(e), text: [text], ink, wide: false }),
    el("div", { className: "kcover-text" },
      el("div", { className: "kcover-lead" }, lead),
      el("div", { className: "kcover-place", style: { fontSize: cq(fit.size) } }, ...fit.lines.map((l) => el("span", {}, l)))));
}

/* ---------------- the share image: 1200x630, plus the lockup, title, date and role ---------------- */

const SERIF = "Instrument Serif";
const SANS = "Geist";

/** The lockup as the site header draws it: the Kleros logo and "Events" in Instrument Serif. */
function lockup(x: number, y: number, logoH: number): CoverNode {
  return el("div", { style: { position: "absolute", left: r1(x) + "px", top: r1(y) + "px", display: "flex", alignItems: "center" } },
    el("img", { src: LOGO, width: r1((logoH * 959) / 360), height: r1(logoH), alt: "", style: { display: "flex" } }),
    el("div", { style: { display: "flex", fontFamily: SERIF, fontSize: r1(logoH * 0.966) + "px", lineHeight: 1, color: INK, marginLeft: r1(logoH * 0.207) + "px", marginTop: r1(logoH * 0.034) + "px" } }, "Events"));
}
/**
 * One line of share text. satori measures a word glyph by glyph without kerning but draws it with kerning, so the gap
 * after a long word opens up; with no-break spaces the whole line is one run, drawn kerned at even spacing.
 */
const line = (s: string): CoverNode => el("div", { style: { display: "flex", whiteSpace: "nowrap" } }, s.replace(/ /g, "\u00A0"));

function share(e: CoverEvent): CoverNode {
  const { width: w, height: h } = SHARE_SIZE;
  const m = 80, top = 64, bottom = 68;
  const logoH = h * 0.075;                        // 47px: the brand's 80px-at-1080 minimum for a lockup
  const GAP = 32, MIN_COL = 504, MAX_COL = 624;
  const v = variation(e.slug, "share");
  // the text column ends at least GAP left of the solid's projected left edge; when the solid sits too far left
  // for a readable column, it moves right (the frame crops it) instead of the type running into it
  let sol = project(v.M, v.cx * w, v.cy * h, v.r * h);
  const room = Math.min(...sol.P2.map((p) => p[0])) - GAP - m;
  if (room < MIN_COL) sol = project(v.M, v.cx * w + (MIN_COL - room), v.cy * h, v.r * h);
  const colW = Math.min(MAX_COL, Math.max(MIN_COL, room));

  const word = placeWord(e), lead = leadIn(e);
  const leadSize = h * 0.062, titleSize = h * 0.046, metaSize = h * 0.036;
  const titleGap = h * 0.045, metaGap = h * 0.016;
  const title = clampLines(e.title || "", colW, (s) => em(GEIST_MEDIUM_ADV, s, 1.05) * titleSize, 2);
  const date = fmtRange(e.starts_on, e.ends_on), role = ROLE_LABEL[e.kleros_role];
  const oneLine = [date, role].filter(Boolean).join(" · ");
  const meta = em(GEIST_ADV, oneLine, 1.05) * metaSize <= colW ? [oneLine] : [date, role].filter(Boolean);
  // the place takes what height is left under the lockup
  const rest = leadSize * 1.2 + titleGap + title.length * titleSize * 1.3 + metaGap + meta.length * metaSize * 1.3;
  const room2 = h - bottom - (top + logoH + 48) - rest;
  const fit = fitPlace(word, colW, [h * 0.2, h * 0.165, h * 0.13], [h * 0.165, h * 0.13, 0]);
  const size = Math.min(fit.size, room2 / (fit.lines.length * 1.02));
  const stackTop = h - bottom - rest - fit.lines.length * size * 1.02;

  const pad = 16;
  const text: Rect[] = [
    { x0: m - pad, y0: stackTop - pad, x1: m + colW + pad, y1: h },
    { x0: m - pad, y0: top - pad, x1: m + 300, y1: top + logoH + pad },
  ];
  return el("div", { style: { position: "relative", display: "flex", width: w + "px", height: h + "px", overflow: "hidden", backgroundColor: GROUND_END } },
    ground({ w, h, uid: uidOf(e, "share"), v, sol, online: isOnline(e), text, wide: true }),
    lockup(m, top, logoH),
    el("div", { style: { position: "absolute", left: m + "px", bottom: bottom + "px", width: r1(colW) + "px", display: "flex", flexDirection: "column" } },
      el("div", { style: { display: "flex", fontFamily: SERIF, fontStyle: "italic", fontSize: r1(leadSize) + "px", lineHeight: 1.2, color: LAVENDER } }, lead),
      el("div", { style: { display: "flex", flexDirection: "column", fontFamily: SERIF, fontSize: r1(size) + "px", lineHeight: 1.02, letterSpacing: "-0.005em", color: INK } }, ...fit.lines.map(line)),
      el("div", { style: { display: "flex", flexDirection: "column", marginTop: r1(titleGap) + "px", fontFamily: SANS, fontWeight: 500, fontSize: r1(titleSize) + "px", lineHeight: 1.3, color: TITLE } }, ...title.map(line)),
      el("div", { style: { display: "flex", flexDirection: "column", marginTop: r1(metaGap) + "px", fontFamily: SANS, fontWeight: 400, fontSize: r1(metaSize) + "px", lineHeight: 1.3, color: MUTED } }, ...meta.map(line))));
}

/** The event's designed cover. The variant is always explicit: it is never read from a size or an aspect ratio. */
export function coverTree(e: CoverEvent, opts: { variant: CoverVariant }): CoverNode {
  return opts.variant === "share" ? share(e) : card(e);
}

/** The share image for a page with no public event behind it: the ground and the lockup, nothing about the event. */
export function shareFallbackTree(): CoverNode {
  const { width: w, height: h } = SHARE_SIZE;
  const v = variation("kleros-events", "share");
  const sol = project(v.M, v.cx * w, v.cy * h, v.r * h);
  const logoH = h * 0.1;
  const y = (h - logoH) / 2;
  return el("div", { style: { position: "relative", display: "flex", width: w + "px", height: h + "px", overflow: "hidden", backgroundColor: GROUND_END } },
    ground({ w, h, uid: "kcfallback", v, sol, online: false, text: [{ x0: 64, y0: y - 16, x1: 560, y1: y + logoH + 16 }], wide: true }),
    lockup(80, y, logoH));
}
