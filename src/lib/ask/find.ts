// Ask, as a smart search of the site with no AI. The question picks one lookup (events coming up,
// past or in a month, the event or talk on screen, the latest talks, the team, or a search of the
// whole site) and the result is written out as a short Markdown answer with links. It costs
// nothing to run and needs no key.
//
// Everything from the database goes through md() (or urlOut() for addresses), so text that
// people typed (titles, descriptions, transcripts) can never form a link, bold, a heading or a list.
import { fmtRange, fold, cleanDescription } from "@/lib/format";
import { LUMA_URL } from "@/lib/kleros";
import { SLUG, cleanUrl, collectLinks, getEvent, getTranscript, listTeam, remember, search, searchTerms, type ToolContext } from "./tools";

export type Intent = "upcoming" | "past" | "dated" | "now" | "events" | "event" | "talk" | "talks" | "team" | "about" | "search" | "chat";

export interface Found {
  intent: Intent;
  /** the distinctive words looked for */
  terms: string[];
  /** nothing matched */
  empty: boolean;
  /** the answer as Markdown, links included */
  markdown: string;
}

// Words that say what kind of answer is wanted rather than what it is about.
const GENERIC = new Set((
  "kleros event events talk talks recording recordings session sessions video videos slide slides deck decks " +
  "tell show find give list know see watch read summarize summarise summary main point points question questions " +
  "came come covered cover covers mention mentioned mentions say said says speak spoke speaks talked talking " +
  "discuss discussed discussing upcoming coming next future soon planned plan plans going go goes attend attended " +
  "attending past previous last recent recently went been happen happened happening site page here " +
  "anything something everything please me us you take takes taking part involved join joining joined " +
  "participate participating speaker speakers presented present presenting who what which how why where when " +
  "year years month months week weeks day days today tomorrow there any some can could would should will " +
  "up also else more new latest newest all other others kind kinds type types thing things info information " +
  "details detail does do get got explain explained mean means meaning now currently right " +
  // pronouns and what is left of contractions ("it's" gives "it")
  "it he she him her his hers my mine we me im ive ll re ve " +
  // greetings and fillers
  "hi hello hey like want wanted wondering thanks thank ok okay cool great sure yes " +
  // Spanish and Portuguese question words for events and talks
  "eventos evento charlas charla proximos proximo proximas proxima donde cuando cuales cual hay"
).split(" "));

// On an event or talk page, words that ask about that page ("What's the agenda?", "Who gave it?").
const PAGE_WORDS = new Set((
  "agenda schedule program programme start starts starting begin begins end ends venue location address " +
  "ticket tickets free price cost register registration rsvp date dates time times transcript recording " +
  "watch gave given give slides speakers organiser organizer organised organized website link about"
).split(" "));

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_WORDS = new Set([...MONTHS, "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"]);
// Month names in full. "May" counts with a capital, or in lower case only after "in", "during" and
// the like or before a number, so "it may rain" is not May. Short forms only before a number
// ("Dec 2026", "Nov 5"), so "Mar del Plata" is not March.
const MONTH_RE = /\b(january|february|march|april|june|july|august|september|october|november|december)\b/i;
const MAY_RE = /\bMay\b|\b(?:in|during|for|of|since|until)\s+may\b|\bmay\s+(?:\d|20\d\d)/i;
const SHORT_MONTH_RE = /\b(jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?\s+\d/i;

const UPCOMING = /\b(upcoming|coming up|next|future|soon|will (?:be|go|attend|speak|host)|going to|planned|later this|still to come|pr[oó]xim[oa]s?)\b/i;
const PAST = /\b(past|previous|last|recent(?:ly)?|went|attended|was at|were at|happened|so far|already)\b/i;
const PAST_TENSE = /\b(did|was|were|went|attended|spoke|hosted|sponsored)\b/i;
const NOW = /\b(now|currently|right now|this week|today|happening)\b/i;
const EVENTS_WORD = /\b(events?|eventos?|conferences?|meetups?|hackathons?|where)\b/i;
const TALKS_WORD = /\b(talks?|recordings?|videos?|sessions?|charlas?)\b/i;
const LATEST = /\b(latest|recent|newest|new)\b/i;
const TEAM = /\b(team|members?|who works|book(?:ing)?|meeting|meet (?:with )?(?:someone|the team|kleros)|contact)\b/i;
const TEAM_WORDS = new Set("team member members book booking meeting meetings meet call calls contact works".split(" "));
const INVITE = /\b(invite|inviting|invitation)\b|\bspeak at (?:my|our)\b|\bhave kleros\b|\bget kleros\b/i;
const ABOUT = /\b(?:what(?:'s| is| does)|how (?:does|do)|explain|tell me about|who is)\b.*\bkleros\b|\bkleros\b.*\bwork/i;
const ABOUT_WORDS = new Set("work works working".split(" "));
const HERE = /\b(?:this|the) (?:event|talk|recording|session|conference|meetup|video|page|one)\b|\bhere\b/i;
const THANKS = /^\s*(?:thanks?|thank you|ty|ok(?:ay)?|cool|great|got it|perfect|nice)\b[\s.!]*$/i;
const FOLLOW_UP = /^\s*(?:and|what about|how about|or|also)\b/i;
const URL_RE = /https?:\/\/\S+/gi;

/** Text from the database as Markdown that shows it as written: one line, with \ [ ] * escaped. */
const md = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().replace(/([\\[\]*])/g, "\\$1");
/** The same, for text that starts its own line: a leading #, -, • or "1." stays text, not a heading or a list. */
const mdPara = (s: string | null | undefined) => md(s).replace(/^(#{1,6}|[-+•>]|\d+[.)])(?=\s|$)/, "\\$1");
/** An address as a bare link when it is a plain web address, else as escaped text. */
const urlOut = (u: string | null | undefined) => (cleanUrl(u) ? u! : md(u));
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
const link = (label: string, href: string | null) => (href ? `[${md(label) || "Open"}](${href})` : md(label));
const eventHref = (slug: string) => (SLUG.test(slug) ? `/events/${slug}` : null);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The terms that matter: the question's words without the question words, at most six. */
function topicTerms(q: string, drop?: Set<string>) {
  return searchTerms(q, Infinity)
    .filter((t) => { const f = fold(t); return !GENERIC.has(f) && !MONTH_WORDS.has(f) && !/^\d{4}$/.test(t) && !drop?.has(f); })
    .slice(0, 6);
}

/**
 * Whether a folded text has the term as a word. Terms of up to 3 letters (like "ai" or "dao")
 * must be whole words, so "ai" does not find "Chiang Mai"; longer ones may start a word, and a
 * plural also finds the singular ("agents" finds "agent" and "agentic", "votes" finds "vote").
 */
export function hasWord(text: string, term: string) {
  const stems = [term];
  if (term.length > 4 && term.endsWith("s")) stems.push(term.slice(0, -1));
  if (term.length > 5 && term.endsWith("es")) stems.push(term.slice(0, -2));
  const end = term.length <= 3 ? "(?![\\p{L}\\p{N}])" : "";
  return stems.some((s) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(s)}${end}`, "u").test(text));
}
const score = (text: string, terms: string[]) => { const t = fold(text); return terms.filter((x) => hasWord(t, fold(x))).length; };

/** "2026-11-11 to 2026-12-30, 10:00 (Asia/Bangkok)" as the site writes dates: "11 Nov – 30 Dec 2026, 10:00 (Asia/Bangkok)". */
const niceDates = (s: string) => s.replace(/^(\d{4}-\d{2}-\d{2})(?: to (\d{4}-\d{2}-\d{2}))?/, (_m, a: string, b?: string) => fmtRange(a, b));

type Span = { from: string; to: string; label: string; yearless: boolean };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * A time the question names, as a window of dates: a month (with or without a year), this, next or
 * last month, this or next week, or a year. A month with no year is the next one to come, or with
 * `past` the latest one that has begun.
 */
function dateSpan(q: string, today: string, past: boolean): Span | null {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const month = (yy: number, mm: number, yearless = false): Span => {
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const p = String(mm).padStart(2, "0");
    return { from: `${yy}-${p}-01`, to: `${yy}-${p}-${last}`, label: `${MONTHS[mm - 1][0].toUpperCase()}${MONTHS[mm - 1].slice(1)} ${yy}`, yearless };
  };
  const week = (offset: number, label: string): Span => {
    const d = new Date(`${today}T12:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5 + offset * 7 * 864e5);
    return { from: iso(monday), to: iso(new Date(monday.getTime() + 6 * 864e5)), label, yearless: false };
  };
  const year = q.match(/\b(20\d\d)\b/)?.[1];
  if (/\bthis month\b/i.test(q)) return month(y, m);
  if (/\bnext month\b/i.test(q)) return m === 12 ? month(y + 1, 1) : month(y, m + 1);
  if (/\blast month\b/i.test(q)) return m === 1 ? month(y - 1, 12) : month(y, m - 1);
  if (/\bthis week\b/i.test(q)) return week(0, "this week");
  if (/\bnext week\b/i.test(q)) return week(1, "next week");
  if (/\blast week\b/i.test(q)) return week(-1, "last week");
  const named = q.match(MONTH_RE)?.[1] ?? (MAY_RE.test(q) ? "may" : undefined) ?? q.match(SHORT_MONTH_RE)?.[1];
  if (named) {
    const mm = MONTHS.findIndex((x) => x.startsWith(named.toLowerCase().slice(0, 3))) + 1;
    if (year) return month(Number(year), mm);
    return month(past ? (mm > m ? y - 1 : y) : (mm < m ? y + 1 : y), mm, true);
  }
  if (/\bthis year\b/i.test(q)) return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y), yearless: false };
  if (/\bnext year\b/i.test(q)) return { from: `${y + 1}-01-01`, to: `${y + 1}-12-31`, label: String(y + 1), yearless: false };
  if (/\blast year\b/i.test(q)) return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: String(y - 1), yearless: false };
  if (year) return { from: `${year}-01-01`, to: `${year}-12-31`, label: year, yearless: false };
  return null;
}

const ROLE: Record<string, string> = {
  host: "Kleros hosts it", co_host: "Kleros co-hosts it", speaking: "Kleros speaks there", sponsor: "Kleros sponsors it",
  booth: "Kleros has a booth", judging: "Kleros judges there", attending: "Kleros attends",
};
const ROLE_PAST: Record<string, string> = {
  host: "Kleros hosted it", co_host: "Kleros co-hosted it", speaking: "Kleros spoke there", sponsor: "Kleros sponsored it",
  booth: "Kleros had a booth", judging: "Kleros judged there", attending: "Kleros attended",
};

type Ev = {
  slug: string; title: string; kleros_role: string; organizer: string | null; event_type: string; starts_on: string; ends_on: string | null;
  city: string | null; country: string | null; region: string | null; venue: string | null; topics: string[] | null;
  description: string | null; recap: string | null; status: string; visibility: string;
};
const placeOf = (e: Pick<Ev, "city" | "country" | "region">) => [e.city, e.country].filter(Boolean).join(", ") || (e.region === "Online" ? "Online" : e.region ?? "");
const endOf = (e: Pick<Ev, "starts_on" | "ends_on">) => e.ends_on ?? e.starts_on;
const notes = (e: Pick<Ev, "status" | "visibility">) => [e.visibility === "private" ? "private" : "", e.status === "draft" ? "draft" : ""].filter(Boolean);
const eventText = (e: Ev) => [e.title, placeOf(e), e.region, e.venue, e.organizer, e.event_type, ...(e.topics ?? []), e.description, e.recap].join(" ");

function eventLine(ctx: ToolContext, e: Ev) {
  const href = eventHref(e.slug);
  if (href) remember(ctx, href, e.title);
  const where = placeOf(e);
  const flag = notes(e);
  const role = (endOf(e) < ctx.today ? ROLE_PAST : ROLE)[e.kleros_role];
  const tail = [role, flag.length ? `(${flag.join(", ")})` : ""].filter(Boolean).join(" ");
  return `- ${link(e.title, href)}: ${fmtRange(e.starts_on, e.ends_on)}${where ? `, ${md(where)}` : ""}.${tail ? ` ${tail}.` : ""}`;
}

async function readEvents(ctx: ToolContext): Promise<Ev[]> {
  const { data, error } = await ctx.sb.from("events")
    .select("slug, title, kleros_role, organizer, event_type, starts_on, ends_on, city, country, region, venue, topics, description, recap, status, visibility")
    .eq("is_example", false).order("starts_on", { ascending: true }).limit(1000);
  if (error) throw new Error("events");
  return (data ?? []) as Ev[];
}

/** Events that match every term, the best first; none when no event has them all. */
const matching = (rows: Ev[], terms: string[]) => terms.length ? rows.filter((e) => score(eventText(e), terms) === terms.length) : rows;

/** Upcoming events soonest first, then past ones latest first. */
const byWhen = (rows: Ev[], today: string) => [
  ...rows.filter((e) => endOf(e) >= today),
  ...rows.filter((e) => endOf(e) < today).reverse(),
];

type When = "upcoming" | "past" | "dated" | "now" | "events";

/** A list of events: coming up, past, happening now, in a time window, or simply matching some words. */
async function eventList(ctx: ToolContext, when: When, terms: string[], span: Span | null): Promise<Found> {
  const all = await readEvents(ctx);
  const pick = (w: When, s: Span | null) => {
    let rows = all;
    if (w === "upcoming") rows = rows.filter((e) => endOf(e) >= ctx.today);
    if (w === "past") rows = rows.filter((e) => endOf(e) < ctx.today).reverse();
    if (w === "now") rows = rows.filter((e) => e.starts_on <= ctx.today && endOf(e) >= ctx.today);
    if (s) rows = rows.filter((e) => e.starts_on <= s.to && endOf(e) >= s.from);
    if (w === "dated" || w === "events") rows = byWhen(rows, ctx.today);
    return rows;
  };
  let rows = pick(when, span);
  // a month with no year that has nothing ahead: the same month just gone
  if (span?.yearless && when !== "past" && !matching(rows, terms).length) {
    const back = dateSpan(span.label.replace(/ \d{4}$/, ""), ctx.today, true);
    if (back && back.from !== span.from) { const r = pick(when === "upcoming" ? "dated" : when, back); if (matching(r, terms).length) { rows = r; span = back; when = "dated"; } }
  }
  const pool = rows;
  rows = matching(rows, terms);

  const inSpan = span ? ` in ${span.label}` : "";
  const about = terms.length ? ` matching “${md(terms.join(" "))}”` : "";
  const shown = rows.slice(0, 8);
  const head = when === "upcoming" ? `Coming up${inSpan}${about}:`
    : when === "past" ? `Past events${inSpan}${about}, most recent first:`
    : when === "now" ? `Happening now${about}:`
    : `Events${inSpan}${about}:`;
  const page = when === "past" ? "/events?when=past" : when === "upcoming" ? "/events?when=upcoming" : "/events";
  const more = rows.length > shown.length ? `\n\nAnd ${rows.length - shown.length} more on the [events page](${page}).` : "";
  let markdown: string;
  if (shown.length) markdown = `${head}\n\n${shown.map((e) => eventLine(ctx, e)).join("\n")}${more}`;
  else if (when === "now") {
    const next = all.filter((e) => e.starts_on > ctx.today).slice(0, 3);
    markdown = `Nothing${about} is happening right now.${next.length ? ` Coming up next:\n\n${next.map((e) => eventLine(ctx, e)).join("\n")}` : ""}`;
  } else if (terms.length && pool.length) {
    const kind = when === "past" ? "past events" : when === "upcoming" ? "upcoming events" : "events";
    markdown = `No ${kind}${inSpan} match “${md(terms.join(" "))}”. ${when === "past" ? "The most recent" : when === "upcoming" ? "Coming up" : "The others"}${inSpan}:\n\n${pool.slice(0, 5).map((e) => eventLine(ctx, e)).join("\n")}`;
  } else if (when === "upcoming") {
    ctx.links.add(LUMA_URL);
    markdown = `No upcoming events are listed${inSpan} yet. New ones are added as soon as they are announced. See [all events](/events), or follow Kleros on Luma: ${LUMA_URL}`;
  } else markdown = `No events${inSpan} found on the site. See [all events](/events).`;
  return { intent: when, terms, empty: !shown.length, markdown };
}

/** The event on screen. */
async function eventHere(ctx: ToolContext, slug: string): Promise<Found | null> {
  const e = await getEvent(ctx, { slug });
  if ("error" in e) return null;
  collectLinks(e, ctx.links);
  const href = eventHref(e.slug);
  const parts: string[] = [];
  const past = (e.dates.match(/(\d{4}-\d{2}-\d{2})(?:,|$)/)?.[1] ?? e.dates.slice(0, 10)) < ctx.today;
  parts.push(`**${md(e.title)}**: ${md(niceDates(e.dates))}${e.place ? `, ${md(e.place)}` : ""}. ${past ? e.kleros.replace(/^Kleros (\w+)s\b/, (_m, v: string) => `Kleros ${v === "attend" ? "attended" : v}`) : e.kleros}${e.organiser ? `, organised by ${md(e.organiser)}` : ""}.`.replace(/\.\./g, "."));
  const about = cleanDescription(e.recap || e.description, e.title).replace(/\s+/g, " ").trim();
  if (about) parts.push(mdPara(short(about, 600)));
  if (e.kleros_team.length) parts.push(`**From Kleros:** ${e.kleros_team.map((t) => md(t.name) + (t.part ? ` (${md(t.part)})` : t.role ? ` (${md(t.role)})` : "")).join(", ")}.`);
  const talks = e.materials.filter((m) => m.page);
  if (talks.length) parts.push(`**Talks and recordings:**\n${talks.slice(0, 10).map((m) => `- ${link(m.title, m.page)}${m.speaker ? `, ${md(m.speaker)}` : ""}${m.length ? `, ${m.length}` : ""}`).join("\n")}${talks.length > 10 ? `\n- and ${talks.length - 10} more on the event page` : ""}`);
  if (e.agenda.length) parts.push(`**Agenda:**\n${e.agenda.slice(0, 10).map((a) => `- ${a.time ? `${a.time} ` : ""}${md(a.title)}${a.speaker ? `, ${md(a.speaker)}` : ""}`).join("\n")}${e.agenda.length > 10 ? `\n- and ${e.agenda.length - 10} more on the event page` : ""}`);
  const others = e.materials.filter((m) => !m.page && m.link).length;
  if (others && href) parts.push(`The [event page](${href}) also has ${others === 1 ? "one more link" : `${others} more links`} (slides, posts or photos).`);
  if (e.event_link) parts.push(`Event website: ${urlOut(e.event_link)}`);
  return { intent: "event", terms: [], empty: false, markdown: parts.join("\n\n") };
}

/** The talk or recording on screen: its stored summary, main points and chapters. */
async function talkHere(ctx: ToolContext, id: string): Promise<Found | null> {
  const t = await getTranscript(ctx, { material_id: id, from_seconds: null }) as Record<string, unknown>;
  if (t.error || typeof t.title !== "string") return null;
  const head = t as unknown as { title: string; speaker: string | null; page: string; event: { title: string; slug: string } | null; length: string | null; summary?: { tldr?: string; key_points?: string[]; chapters?: string[]; action_items?: string[] } };
  const hasText = "lines_from" in t;
  const parts = [`**${md(head.title)}**${head.speaker ? `, ${md(head.speaker)}` : ""}${head.event ? `, at ${link(head.event.title, eventHref(head.event.slug))}` : ""}${head.length ? ` (${head.length})` : ""}.`];
  const s = head.summary;
  if (s?.tldr) parts.push(mdPara(s.tldr));
  if (s?.key_points?.length) parts.push(`**Main points:**\n${s.key_points.slice(0, 8).map((p) => `- ${md(p)}`).join("\n")}`);
  if (s?.chapters?.length) parts.push(`**Chapters:**\n${s.chapters.slice(0, 12).map((c) => {
    const m = c.match(/^((?:\d+:)?\d{2}:\d{2}) (.*)$/);
    if (!m) return `- ${md(c)}`;
    const secs = m[1].split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
    return `- [${m[1]}](${head.page}?t=${secs}) ${md(m[2])}`;
  }).join("\n")}`);
  if (s?.action_items?.length) parts.push(`**Follow-ups mentioned:**\n${s.action_items.slice(0, 8).map((a) => `- ${md(a)}`).join("\n")}`);
  if (!s?.tldr && !s?.key_points?.length) {
    parts.push(hasText
      ? "There is no written summary of this one yet. The full transcript is on this page, under the player."
      : "There is no transcript or summary of this one yet.");
  } else if (hasText) parts.push("The full transcript is on this page, under the player.");
  return { intent: "talk", terms: [], empty: false, markdown: parts.join("\n\n") };
}

/** The newest talks and recordings on the site. */
async function latestTalks(ctx: ToolContext, terms: string[]): Promise<Found> {
  const { data, error } = await ctx.sb.from("materials")
    .select("id, kind, title, speaker, file_path, duration_seconds, created_at, events!materials_event_id_fkey(slug, title, starts_on)")
    .in("kind", ["talk", "video", "audio"]).order("created_at", { ascending: false }).limit(60);
  if (error) throw new Error("materials");
  type Row = { id: string; kind: string; title: string; speaker: string | null; file_path: string | null; duration_seconds: number | null; events: { slug: string; title: string; starts_on: string } | null };
  let rows = ((data ?? []) as unknown as Row[]).filter((m) => m.kind !== "audio" || m.file_path);
  // newest event first, then newest added
  rows.sort((a, b) => (b.events?.starts_on ?? "").localeCompare(a.events?.starts_on ?? ""));
  if (terms.length) rows = rows.filter((m) => score(`${m.title} ${m.speaker ?? ""} ${m.events?.title ?? ""}`, terms) === terms.length);
  const lines = rows.slice(0, 6).map((m) => {
    remember(ctx, `/talks/${m.id}`, m.title);
    return `- ${link(m.title, `/talks/${m.id}`)}${m.speaker ? `, ${md(m.speaker)}` : ""}${m.events ? `, at ${link(m.events.title, eventHref(m.events.slug))}` : ""}`;
  });
  return {
    intent: "talks", terms, empty: !lines.length,
    markdown: lines.length ? `The latest talks${terms.length ? ` matching “${md(terms.join(" "))}”` : ""}:\n\n${lines.join("\n")}\n\nAll of them are on the [Talks page](/talks).` : "No talks on the site match that yet. See [all talks](/talks).",
  };
}

async function team(ctx: ToolContext, invite: boolean): Promise<Found> {
  const out = await listTeam(ctx);
  collectLinks(out, ctx.links);
  const lines = out.team.map((t) => `- **${md(t.name)}**${t.role ? `, ${md(t.role)}` : ""}${t.book_a_meeting ? `. Book a meeting: ${urlOut(t.book_a_meeting)}` : ""}`);
  const form = "To invite Kleros to speak, host or take part in an event, use the [invite form](/contact).";
  return {
    intent: "team", terms: [], empty: false,
    markdown: invite ? `${form}${lines.length ? `\n\nOr reach a team member directly:\n\n${lines.join("\n")}` : ""}`
      : lines.length ? `Kleros team members listed on the site:\n\n${lines.join("\n")}\n\n${form}` : `The site has no team list yet. ${form}`,
  };
}

/** "What is Kleros?": a few plain lines and where to read more. */
function aboutKleros(ctx: ToolContext): Found {
  ctx.links.add("https://kleros.io/");
  ctx.links.add("https://docs.kleros.io/");
  return {
    intent: "about", terms: [], empty: false,
    markdown: "Kleros is a decentralized dispute resolution protocol. When two parties disagree, independent jurors who have staked PNK tokens are drawn at random, review the evidence and vote, and an appeal sends the case to a larger jury.\n\nThis site lists the events where Kleros hosts, speaks or takes part, with the talks from them. To read more about how Kleros works, see https://kleros.io/ and the documentation at https://docs.kleros.io/",
  };
}

type SearchOut = Exclude<Awaited<ReturnType<typeof search>>, { error: string }>;

/** A search of the whole site: events (every field), talks, other items, agenda items and transcripts. */
async function siteSearch(ctx: ToolContext, terms: string[]): Promise<Found> {
  if (!terms.length) return nothing(terms);
  const [events, r] = await Promise.all([readEvents(ctx), search(ctx, { query: terms.join(" ") })]);
  const out = "error" in r ? null : r as SearchOut;
  if (out) collectLinks(out, ctx.links);
  // events: every term somewhere in the event; else the best partial matches
  let evs = byWhen(matching(events, terms), ctx.today);
  if (!evs.length && terms.length > 1) {
    const scored = events.map((e) => ({ e, n: score(eventText(e), terms) })).filter((x) => x.n >= Math.ceil(terms.length / 2));
    evs = scored.sort((a, b) => b.n - a.n).map((x) => x.e);
  }
  const talks = (out?.transcripts ?? []).map((t) => ({ ...t, lines: t.lines.filter((l) => score(l.text, terms)) }))
    .filter((t) => t.lines.length || score(`${t.title} ${t.speaker ?? ""}`, terms));
  const seen = new Set(talks.map((t) => t.material_id));
  const mats = (out?.materials ?? []).filter((m) => !seen.has(m.material_id) && score(`${m.title} ${m.speaker ?? ""}`, terms));
  const agenda = (out?.agenda ?? []).filter((a) => score(`${a.title} ${a.speaker ?? ""}`, terms));

  const parts: string[] = [];
  if (evs.length) parts.push(`#### Events\n${evs.slice(0, 6).map((e) => eventLine(ctx, e)).join("\n")}${evs.length > 6 ? `\n\nAnd ${evs.length - 6} more.` : ""}`);
  const talkLines = [
    ...talks.map((t) => {
      remember(ctx, t.page, t.title);
      const moments = t.lines.slice(0, 2).map((l) => `[${l.at}](${t.page}?t=${l.seconds}) “${md(short(l.text, 140))}”`);
      return `- ${link(t.title, t.page)}${t.speaker ? `, ${md(t.speaker)}` : ""}${t.event ? `, at ${md(t.event)}` : ""}${moments.length ? `. ${moments.join(" and ")}` : ""}`;
    }),
    ...mats.map((m) => {
      if (m.page) remember(ctx, m.page, m.title);
      const at = m.event && m.event_slug ? `, at ${link(m.event, eventHref(m.event_slug))}` : "";
      // a link of its own goes last, so the punctuation after it is not part of it
      return m.page ? `- ${link(m.title, m.page)}${m.speaker ? `, ${md(m.speaker)}` : ""}${at}`
        : `- ${md(m.title)}${m.speaker ? `, ${md(m.speaker)}` : ""}${at}${m.link ? `: ${urlOut(m.link)}` : ""}`;
    }),
  ];
  if (talkLines.length) parts.push(`#### Talks and recordings\n${talkLines.slice(0, 8).join("\n")}${talkLines.length > 8 ? `\n\nAnd ${talkLines.length - 8} more. Add a word or two to narrow it down.` : ""}`);
  if (agenda.length && parts.length < 2) {
    parts.push(`#### On event agendas\n${agenda.slice(0, 4).map((a) => `- ${md(a.title)}${a.speaker ? `, ${md(a.speaker)}` : ""}, at ${link(a.event, eventHref(a.event_slug))}`).join("\n")}`);
  }
  const partial = !out || out.not_searched;
  if (!parts.length) return nothing(terms, !!partial);
  return {
    intent: "search", terms, empty: false,
    markdown: `What the site has on “${md(terms.join(" "))}”:\n\n${parts.join("\n\n")}${partial ? "\n\nPart of the site could not be searched just now, so there may be more." : ""}`,
  };
}

function nothing(terms: string[], partial = false): Found {
  const words = md(terms.join(" "));
  return {
    intent: "search", terms, empty: true,
    markdown: partial
      ? `Part of the site could not be searched just now, and nothing turned up${words ? ` on “${words}”` : ""}. Try again in a minute.`
      : terms.length
        ? `Nothing on the site mentions “${words}” yet. Try other words, or browse [the events](/events) and [the talks](/talks).`
        : "Ask about an event, a place, a topic or a speaker, for example “Which events are coming up?”, “Events in Asia” or “Talks about AI agents”.",
  };
}

/** Reads what the question asks for. `page` is the page the visitor is on. */
export async function find(ctx: ToolContext, question: string, page: string | null): Promise<Found> {
  let q = question.trim().replace(/[‘’ʼ]/g, "'");
  let ev = page?.match(/^\/events\/([a-z0-9][a-z0-9-]{0,199})\/?$/)?.[1];
  let talk = page?.match(/^\/talks\/([0-9a-f-]{36})\/?$/i)?.[1]?.toLowerCase();
  // a pasted link: one of this site's event or talk pages answers for that page; any other address is left out
  const urls = q.match(URL_RE) ?? [];
  for (const u of urls) {
    const p = u.replace(/^https?:\/\/[^/]+/i, "");
    const e2 = p.match(/^\/events\/([a-z0-9][a-z0-9-]{0,199})\/?(?:[?#].*)?$/)?.[1];
    const t2 = p.match(/^\/talks\/([0-9a-f-]{36})\/?(?:[?#].*)?$/i)?.[1]?.toLowerCase();
    if (e2 || t2) { ev = e2; talk = t2; }
  }
  q = q.replace(URL_RE, " ").trim();
  if (!q && (ev || talk) && urls.length) q = "this page";
  if (!q) return nothing([]);
  if (THANKS.test(q)) return { intent: "chat", terms: [], empty: false, markdown: "Glad to help. Ask about another event, place, topic or speaker any time." };

  const terms = topicTerms(q);
  const pastWords = PAST.test(q) || PAST_TENSE.test(q);
  const span = dateSpan(q, ctx.today, pastWords && !UPCOMING.test(q));
  const here = async () => (ev ? eventHere(ctx, ev) : talk ? talkHere(ctx, talk) : null);

  // the event or talk on screen, when the question points at it
  if ((ev || talk) && HERE.test(q)) { const h = await here(); if (h) return h; }
  if (ABOUT.test(q) && !topicTerms(q, ABOUT_WORDS).length) return aboutKleros(ctx);
  if (INVITE.test(q)) return team(ctx, true);
  if (TEAM.test(q) && topicTerms(q, TEAM_WORDS).length <= 1 && !EVENTS_WORD.test(q)) return team(ctx, false);
  if (LATEST.test(q) && TALKS_WORD.test(q) && !EVENTS_WORD.test(q)) return latestTalks(ctx, terms);
  // on a talk page, only a question that names events turns to the events list
  const listOk = !talk || EVENTS_WORD.test(q);
  if (NOW.test(q) && !span?.label.includes("week") && EVENTS_WORD.test(q) && !pastWords) return eventList(ctx, "now", terms, null);
  if (UPCOMING.test(q) && !PAST.test(q) && listOk) return eventList(ctx, "upcoming", terms, span);
  if (pastWords && (EVENTS_WORD.test(q) || span) && listOk) return eventList(ctx, "past", terms, span);
  // a question about the page on screen with no topic of its own ("Where is it?", "What's the agenda?")
  if ((ev || talk) && terms.every((t) => PAGE_WORDS.has(fold(t)))) { const h = await here(); if (h) return h; }
  if (span && (EVENTS_WORD.test(q) || !terms.length)) {
    return eventList(ctx, span.to < ctx.today ? "past" : span.from > ctx.today ? "upcoming" : "dated", terms, span);
  }
  if (!terms.length && EVENTS_WORD.test(q)) return eventList(ctx, "upcoming", terms, null);
  if (!terms.length && TALKS_WORD.test(q)) return latestTalks(ctx, terms);
  // words with an events word ("events in Europe", "Web3 Foundation events"): the matching events
  if (EVENTS_WORD.test(q)) {
    const list = await eventList(ctx, "events", terms, null);
    if (!list.empty) return list;
  }
  return siteSearch(ctx, terms);
}

/**
 * The same, for a follow-up. A short follow-up with no topic of its own ("and past ones?") or one
 * that starts with "and", "what about" or "or" ("and in Europe?") is read again with the previous
 * question's words after its own, and that answer is kept only when it still covers every word of
 * the follow-up.
 */
export async function findWithHistory(ctx: ToolContext, questions: string[], page: string | null): Promise<Found> {
  const last = questions[questions.length - 1];
  const found = await find(ctx, last, page);
  const prev = questions[questions.length - 2];
  if (!prev || found.intent === "chat" || last.length > 80) return found;
  const followUp = FOLLOW_UP.test(last);
  const bare = !found.terms.length && found.empty;
  if (!followUp && !bare) return found;
  // the list answers already said what they found; only an empty one is worth another try
  if (!followUp && ["upcoming", "past", "dated", "now"].includes(found.intent) && found.terms.length) return found;
  const merged = `${last.replace(FOLLOW_UP, "")} ${prev}`;
  const again = await find({ ...ctx, sources: new Map(), links: new Set() }, merged, page);
  const keeps = found.terms.every((t) => again.terms.includes(t));
  if (again.empty || !keeps || (!found.empty && !followUp)) return found;
  // the second reading's links count, not the first's
  const fresh = await find(ctx, merged, page);
  return fresh;
}
