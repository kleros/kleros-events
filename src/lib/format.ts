import type { EventRow } from "./types";

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const endOf = (e: Pick<EventRow, "starts_on" | "ends_on">) => e.ends_on ?? e.starts_on;
export const isPast = (e: Pick<EventRow, "starts_on" | "ends_on">) => endOf(e) < todayIso();
export const isLive = (e: Pick<EventRow, "starts_on" | "ends_on">) => e.starts_on <= todayIso() && endOf(e) >= todayIso();
export const place = (e: Pick<EventRow, "city" | "country">) => (e.city ? [e.city, e.country].filter(Boolean).join(", ") : "Online");

export function fmtRange(a: string, b?: string | null) {
  const A = new Date(a + "T12:00:00");
  const full: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (!b || b === a) return A.toLocaleDateString("en-GB", { weekday: "short", ...full });
  const B = new Date(b + "T12:00:00");
  return `${A.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${B.toLocaleDateString("en-GB", full)}`;
}

export function fmtDur(s: number | null | undefined) {
  const x = Math.max(0, Math.floor(s ?? 0));
  const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), sec = x % 60;
  return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
}

export function fmtSize(n: number | null | undefined) {
  if (!n) return "";
  return n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.round(n / 1e3) + " KB";
}

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export const soonestFirst = <T extends Pick<EventRow, "starts_on">>(a: T, b: T) => a.starts_on.localeCompare(b.starts_on);
export const newestFirst = <T extends Pick<EventRow, "starts_on">>(a: T, b: T) => b.starts_on.localeCompare(a.starts_on);
/**
 * Past events, most recently ended first, then the later start. A week-long conference comes
 * before the side events that started during it.
 */
export const latestFirst = <T extends Pick<EventRow, "starts_on" | "ends_on">>(a: T, b: T) =>
  endOf(b).localeCompare(endOf(a)) || b.starts_on.localeCompare(a.starts_on);

/** Lower case without accents, so "clement" finds "Clément" and "junin" finds "Junín". */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** True when every word of the search appears somewhere in the text, in any order. */
export function matchesWords(text: string, query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(text);
  return words.every((w) => hay.includes(w));
}

// Lines that only repeat date, time, place or ticket details (Luma descriptions start with them).
const LOGISTICS = /^(?:[\p{Extended_Pictographic}\u2600-\u27BF\uFE0F]|(?:date|time|when|where|location|venue|address|tickets?|register|rsvp)\s*[:\-])/iu;

/** A description without its date, time, place and ticket lines, and without a first line that repeats the title. */
export function cleanDescription(text: string | null | undefined, title = "") {
  const lines = (text ?? "").split(/\n/).map((l) => l.trim());
  const t = fold(title).slice(0, 14);
  const kept = lines.filter((l, i) => l && !LOGISTICS.test(l) && !(i === lines.findIndex(Boolean) && t.length >= 6 && fold(l).startsWith(t) && l.length < 90));
  return kept.join("\n");
}

/** One short paragraph for a card or a link preview: the recap once the event is over, else the description. */
export function excerpt(e: Pick<EventRow, "title" | "description" | "recap" | "starts_on" | "ends_on">) {
  const text = (isPast(e) && e.recap) || e.description;
  return cleanDescription(text, e.title).replace(/\s*\n\s*/g, " ").trim();
}

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/**
 * A same-site path to go to after sign-in, or /me. Rejects `//evil.com` and `/\evil.com`
 * (both leave the site) and control characters, which URL parsers strip (`/\t/evil.com`).
 */
export function safeNext(next: unknown, fallback = "/me"): string {
  if (typeof next !== "string") return fallback;
  return /^\/(?![\/\\])/.test(next) && !/[\x00-\x1f\x7f\\]/.test(next) ? next : fallback;
}
