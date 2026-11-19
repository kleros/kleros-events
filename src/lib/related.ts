import type { EventRow, Material } from "./types";
import { READS, type Read } from "./library";
import { isPast, soonestFirst } from "./format";

/**
 * "You might also like": related talks, events and Kleros reading, picked with plain rules and no AI, so it
 * costs nothing to run. Every item gets topics (events: their own topics plus words in the title; talks:
 * words in the title, then their events' topics) and product names (Curate, Seer, Proof of Humanity, ...).
 * An item scores for each topic it shares with what the visitor saved or is looking at, rarer topics
 * counting more; a shared product name or speaker counts most. The reason shown is the saved item that
 * contributed most ("Because you saved ...").
 */

// words in a title that say what it is about, mapped to the site's topics (lib/kleros TOPICS, plus Identity)
const TOPIC_WORDS: [string, RegExp][] = [
  ["AI agents", /\bai\b|\bia\b|\bagent|agentes|ag[eé]ntic|m[aá]quinas|\bllms?\b|artificial intelligence|machine learning|\bgpt\b|\bmcp\b|x402|erc-?8004/i],
  ["Prediction markets", /prediction market|predict|futarchy|forecast|foresight|\bseer\b|tradable|decision market|polymarket/i],
  ["Oracles", /oracle|reality\.?eth|optimistic/i],
  ["Arbitration", /arbitra|disput|\bcourts?\b|justice|justicia|ruling|\bodr\b|mediat|tribunal|complaint|reclamo/i],
  ["Jurors", /juror|\bjur(y|ies)\b|jurado|staking|\bpnk\b|schelling|peer prediction/i],
  ["Legal tech", /legal|\blaw\b|lawyer|legaltech|judicial|judge|regulat|complian|derecho|jur[ií]dic|legislaci|abogad/i],
  ["Governance", /governance|gobernanza|\bdaos?\b|snapshot|governor|voting|\bvote|treasur|social choice/i],
  ["Identity", /proof of humanity|\bpoh\b|identity|sybil|humanity/i],
  ["Content moderation", /moderation|curate|curation|registr|\blists?\b|scam|spam/i],
  ["Smart contracts", /smart contract|solidity|security|audit|bridge|cross-?chain|\bvea\b|developer|hackathon|\bbuild/i],
  ["DeFi", /\bdefi\b|escrow|payment|insurance|stablecoin|lending/i],
  ["Research", /research|paper|academic|universit|oxford|stanford|fellowship|phd|doctoral|mechanism design|game theory/i],
  ["Community", /community|meetup|general assembly|\bama\b|ecosystem/i],
];

// product and programme names: sharing one is the strongest sign two items belong together
const ENTITIES: [string, RegExp][] = [
  ["Court", /kleros court|court v2|kleros 2\.0|kleros v2|\bjuror/i],
  ["Curate", /curate|registr/i],
  ["Escrow", /escrow/i],
  ["Reality", /reality\.?eth|realitio/i],
  ["Seer", /\bseer\b/i],
  ["Foresight", /foresight|futarchy|decision market/i],
  ["Scout", /\bscout\b/i],
  ["PoH", /proof of humanity|\bpoh\b|humanity court/i],
  ["Vea", /\bvea\b|veashi/i],
  ["Governor", /governor/i],
  ["Snapshot", /snapshot/i],
  ["Agents", /\bai agent|agentic|agent court|\bagents?\b/i],
  ["Fellowship", /fellowship/i],
  ["Oxford", /oxford/i],
  ["Enterprise", /enterprise/i],
  ["Devcon", /devcon/i],
  ["LatAm", /mendoza|argentin|latam|buenos aires|brasil|brazil|m[eé]xico|colombia/i],
];

type Weights = Map<string, number>;
// the same as lib/data eventIdsOf, kept here so this file has no database imports
const eventIdsOf = (m: Pick<Material, "event_id" | "event_ids">) => m.event_ids ?? (m.event_id ? [m.event_id] : []);
const add = (w: Weights, k: string, v: number) => w.set(k, (w.get(k) ?? 0) + v);

export function wordTopics(text: string): string[] {
  return TOPIC_WORDS.filter(([, re]) => re.test(text)).map(([t]) => t);
}
export function entitiesOf(text: string): string[] {
  return ENTITIES.filter(([, re]) => re.test(text)).map(([n]) => n);
}
export const peopleOf = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().split(/[,;&/]|\band\b/).map((x) => x.trim().replace(/^(with|moderated by)\s+/, "").replace(/\s*\(.*$/, ""))
    .filter((x) => x.length > 2 && x !== "others");

/** What one item is about, as weights: words in its own title count double. */
export interface Profile { topics: Weights; entities: Set<string>; people: Set<string>; events: Set<string> }

export function eventProfile(e: Pick<EventRow, "id" | "title" | "topics" | "description">): Profile {
  const topics: Weights = new Map();
  e.topics.forEach((t) => add(topics, t, 1));
  wordTopics(e.title).forEach((t) => add(topics, t, 1));
  return { topics, entities: new Set(entitiesOf(`${e.title} ${(e.description ?? "").slice(0, 600)}`)), people: new Set(), events: new Set([e.id]) };
}

export function materialProfile(m: Pick<Material, "title" | "speaker" | "event_id" | "event_ids">, eventsById: Record<string, EventRow>): Profile {
  const topics: Weights = new Map();
  const own = wordTopics(m.title);
  own.forEach((t) => add(topics, t, 2));
  const evs = eventIdsOf(m).map((id) => eventsById[id]).filter(Boolean);
  // a talk's events say what it is about only loosely; a talk with clear words of its own leans on them
  const share = own.length ? 0.5 : 1;
  evs.forEach((e) => e.topics.forEach((t) => add(topics, t, share / evs.length)));
  return { topics, entities: new Set(entitiesOf(m.title)), people: new Set(peopleOf(m.speaker)), events: new Set(evs.map((e) => e.id)) };
}

export function readProfile(r: Read): Profile {
  const topics: Weights = new Map();
  r.topics.forEach((t) => add(topics, t, 1.5));
  return { topics, entities: new Set(r.about ?? entitiesOf(r.title)), people: new Set(), events: new Set() };
}

/** A thing the visitor saved or is looking at, with the words used in "Because you saved ...". */
export interface Seed { id: string; label: string; profile: Profile; weight?: number }

/** Rarer topics say more: "Identity" shared means more than "Arbitration", which most events have. */
function rarity(pool: Profile[]): (t: string) => number {
  const df = new Map<string, number>();
  pool.forEach((p) => p.topics.forEach((_, t) => add(df, t, 1)));
  const n = Math.max(pool.length, 1);
  return (t) => Math.log(1 + n / (1 + (df.get(t) ?? 0)));
}

interface Scored<T> { item: T; score: number; match: number; because?: Seed }

function scoreAll<T>(items: { item: T; profile: Profile; extra?: number }[], seeds: Seed[], idf: (t: string) => number, talksBy: (p: string) => number): Scored<T>[] {
  return items.map(({ item, profile, extra = 0 }) => {
    let total = 0, best = 0, because: Seed | undefined;
    // long topic lists do not win by being long
    const norm = 1 / Math.sqrt(Math.max(1, [...profile.topics.values()].reduce((a, b) => a + b, 0)));
    for (const s of seeds) {
      let v = 0;
      profile.topics.forEach((w, t) => { const sw = s.profile.topics.get(t); if (sw) v += Math.min(w, 2) * Math.min(sw, 2) * idf(t) * norm; });
      profile.entities.forEach((x) => { if (s.profile.entities.has(x)) v += 2.5; });
      // a speaker who gives few talks says more than one who is on every stage
      profile.people.forEach((x) => { if (s.profile.people.has(x)) v += 6 / (1 + Math.min(talksBy(x), 8) / 2); });
      profile.events.forEach((x) => { if (s.profile.events.has(x)) v += 0.75; });
      v *= s.weight ?? 1;
      total += v;
      if (v > best) { best = v; because = s; }
    }
    const match = total / Math.sqrt(seeds.length);
    return { item, score: match + (total > 0 ? extra : 0), match, because };
  }).filter((x) => x.score > 0.4).sort((a, b) => b.score - a.score);
}

export interface RelatedTalk { m: Material; event?: EventRow; because?: string }
export interface RelatedEvent { e: EventRow; because?: string }
export interface RelatedRead { r: Read; because?: string }
export interface Related { talks: RelatedTalk[]; events: RelatedEvent[]; reads: RelatedRead[] }

/** A saved item's name for "Because you saved ...": without bracketed notes, and not too long. */
const short = (t: string) => {
  const s = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return s.length > 64 ? s.slice(0, 62).replace(/\s+\S*$/, "") + "…" : s;
};

/** A talk's title without the bracketed notes, for spotting the same talk posted twice. */
export const sameTalk = (t: string) => t.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9áéíóúñü]+/g, " ").trim();

const recommendable = (m: Material) => m.kind === "talk" || m.kind === "video" || (m.kind === "audio" && !!m.file_path);

/**
 * Related talks, events and Kleros reading for a set of seeds. Only talks of public, published events
 * (those in `events`, from listEvents) are offered, so a private or draft event's recording never shows.
 * `exclude` holds ids already on the page or already saved.
 */
export function related(seeds: Seed[], events: EventRow[], materials: Material[], opts: {
  exclude?: Set<string>; talks?: number; events?: number; reads?: number; explain?: boolean;
} = {}): Related {
  const exclude = opts.exclude ?? new Set<string>();
  const nTalks = opts.talks ?? 3, nEvents = opts.events ?? 3, nReads = opts.reads ?? 4;
  if (!seeds.length) return { talks: [], events: [], reads: [] };
  const byId: Record<string, EventRow> = Object.fromEntries(events.map((e) => [e.id, e]));
  const talkPool = materials.filter((m) => recommendable(m) && !exclude.has(m.id) && eventIdsOf(m).some((id) => byId[id]))
    .map((m) => ({ item: m, profile: materialProfile(m, byId), extra: /^clip\b/i.test(m.title) ? -0.6 : m.speaker ? 0.3 : 0 }));
  const eventPool = events.filter((e) => !exclude.has(e.id) && !e.is_example)
    .map((e) => ({ item: e, profile: eventProfile(e), extra: isPast(e) ? 0 : 1.2 }));
  const readPool = READS.filter((r) => !exclude.has(`read:${r.id}`))
    .map((r) => ({ item: r, profile: readProfile(r), extra: (r.boost ?? 0) * 0.4 + (r.date && r.date >= "2026" ? 0.2 : 0) }));
  const idf = rarity([...talkPool, ...eventPool, ...readPool].map((x) => x.profile));
  const byPerson = new Map<string, number>();
  talkPool.forEach((x) => x.profile.people.forEach((p) => add(byPerson, p, 1)));
  const talksBy = (p: string) => byPerson.get(p) ?? 0;
  const why = (s?: Seed) => (opts.explain && s ? `Because you saved ${short(s.label)}` : undefined);

  // at most two talks from one event, so the list is not one conference's playlist
  // and one copy of a talk that is posted twice ("Paid to Be Right" and "Paid to Be Right (YouTube)")
  const talks: RelatedTalk[] = [];
  const perEvent = new Map<string, number>();
  const seen = new Set(seeds.map((x) => sameTalk(x.label)));
  for (const { item: m, because } of scoreAll(talkPool, seeds, idf, talksBy)) {
    const ev = eventIdsOf(m).map((id) => byId[id]).find(Boolean);
    const k = ev?.id ?? m.id;
    if ((perEvent.get(k) ?? 0) >= 2 || seen.has(sameTalk(m.title))) continue;
    seen.add(sameTalk(m.title));
    perEvent.set(k, (perEvent.get(k) ?? 0) + 1);
    talks.push({ m, event: ev, because: why(because) });
    if (talks.length >= nTalks) break;
  }
  // upcoming events first (soonest first among the good matches), then past ones with something to watch
  const scoredEvents = scoreAll(eventPool, seeds, idf, talksBy);
  const ahead = scoredEvents.filter((x) => !isPast(x.item)).slice(0, nEvents).sort((a, b) => soonestFirst(a.item, b.item));
  const withTalks = new Set(materials.filter(recommendable).flatMap(eventIdsOf));
  const behind = scoredEvents.filter((x) => isPast(x.item) && withTalks.has(x.item.id));
  // an upcoming event that only loosely matches is still worth showing, but not "because" of anything
  const evs = [...ahead, ...behind].slice(0, nEvents)
    .map(({ item, because, match }) => ({ e: item, because: match >= 1 ? why(because) : opts.explain && !isPast(item) ? "Coming up" : undefined }));

  // reading: no more than two of one kind, so apps, guides and articles all get a place
  const reads: RelatedRead[] = [];
  const perKind = new Map<string, number>();
  for (const { item: r, because } of scoreAll(readPool, seeds, idf, talksBy)) {
    if ((perKind.get(r.kind) ?? 0) >= 2) continue;
    perKind.set(r.kind, (perKind.get(r.kind) ?? 0) + 1);
    reads.push({ r, because: why(because) });
    if (reads.length >= nReads) break;
  }
  return { talks, events: evs, reads };
}

/** For a visitor with nothing saved yet: the pages a newcomer should see first. */
export function startingReads(n = 4): RelatedRead[] {
  return [...READS].sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0)).slice(0, n).map((r) => ({ r }));
}
