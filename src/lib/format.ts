import type { EventRow } from "./types";

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const endOf = (e: Pick<EventRow, "starts_on" | "ends_on">) => e.ends_on ?? e.starts_on;
export const isPast = (e: Pick<EventRow, "starts_on" | "ends_on">) => endOf(e) < todayIso();
export const isLive = (e: Pick<EventRow, "starts_on" | "ends_on">) => e.starts_on <= todayIso() && endOf(e) >= todayIso();
type Where = Pick<EventRow, "city" | "country"> & { region?: EventRow["region"] };
/** Online when the city says so, or when there is no city and the region is Online or nothing is set. */
export function isOnline(e: Where): boolean {
  const city = (e.city ?? "").trim();
  if (city) return /^online$/i.test(city);
  return e.region === "Online" || (!(e.country ?? "").trim() && !(e.region ?? "").trim());
}
/** "City, Country"; the country or the region when there is no city; "Online" by the rule above (the designed cover agrees). */
export const place = (e: Where) =>
  isOnline(e) ? "Online" : e.city?.trim() ? [e.city, e.country].filter(Boolean).join(", ") : (e.country?.trim() || e.region?.trim() || "Online");

// Fixed English names, so the server and the browser print the same text whatever their locale data.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-04" (or a longer ISO timestamp) as its year, month and day; null when it is not a date. */
function ymd(s: string | null | undefined) {
  const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? "");
  if (!x) return null;
  const y = +x[1], m = +x[2], d = +x[3];
  return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { y, m, d } : null;
}

/**
 * A date or a date range: "4 Nov 2026" ("Wed 4 Nov 2026" with `weekday`), "3–6 Nov 2026",
 * "30 Oct – 2 Nov 2026", "30 Dec 2026 – 2 Jan 2027". The weekday only shows on a single day.
 */
export function fmtRange(a: string, b?: string | null, opts: { weekday?: boolean } = {}) {
  const A = ymd(a);
  if (!A) return a;
  const B = b && b !== a ? ymd(b) : null;
  const day = (x: { y: number; m: number; d: number }) => `${x.d} ${MONTHS[x.m - 1]}`;
  if (!B || (B.y === A.y && B.m === A.m && B.d === A.d)) {
    const wd = opts.weekday ? WEEKDAYS[new Date(Date.UTC(A.y, A.m - 1, A.d)).getUTCDay()] + " " : "";
    return `${wd}${day(A)} ${A.y}`;
  }
  if (A.y !== B.y) return `${day(A)} ${A.y} – ${day(B)} ${B.y}`;
  if (A.m !== B.m) return `${day(A)} – ${day(B)} ${B.y}`;
  return `${A.d}–${B.d} ${MONTHS[A.m - 1]} ${A.y}`;
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

/**
 * A Google Calendar "add event" link: one click opens the visitor's own calendar with the event filled in.
 * All-day over the event's dates, or timed (two hours) when it has a start time and an IANA time zone.
 */
export function googleCalendarUrl(e: Pick<EventRow, "title" | "starts_on" | "ends_on" | "start_time" | "timezone" | "venue" | "city" | "country" | "slug">, pageUrl: string) {
  const day = (d: string) => d.replace(/-/g, "");
  const next = (d: string) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title });
  const iana = !!e.timezone && e.timezone.includes("/");
  if (e.start_time && iana && !e.ends_on) {
    const [h, m] = e.start_time.split(":").map(Number);
    const t = (hh: number) => `${String(hh).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    p.set("dates", `${day(e.starts_on)}T${t(h)}/${day(e.starts_on)}T${t(Math.min(h + 2, 23))}`);
    p.set("ctz", e.timezone!);
  } else {
    p.set("dates", `${day(e.starts_on)}/${day(next(e.ends_on ?? e.starts_on))}`);
  }
  const where = [e.venue, e.city, e.country].filter(Boolean).join(", ");
  if (where) p.set("location", where);
  p.set("details", pageUrl);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
