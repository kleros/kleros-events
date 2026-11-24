import type { KlerosRole } from "./types";

/** Address used in share links, QR codes and calendar files: set explicitly, else the host's own. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NETLIFY_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const ROLE_LABEL: Record<KlerosRole, string> = {
  host: "Hosted by Kleros",
  co_host: "Co-hosted by Kleros",
  speaking: "Kleros speaking",
  sponsor: "Kleros sponsoring",
  booth: "Kleros booth",
  judging: "Kleros bounty & judging",
  attending: "Kleros attending",
};
export const ROLE_SHORT: Record<KlerosRole, string> = {
  host: "Host", co_host: "Co-host", speaking: "Speaking", sponsor: "Sponsor", booth: "Booth", judging: "Judging", attending: "Attending",
};
export const KLEROS_HOSTED: KlerosRole[] = ["host", "co_host"];

export const EVENT_TYPES = ["Conference", "Side event", "Meetup", "Hackathon", "Workshop", "Panel", "Online talk / Space", "Academic", "Juror training", "Other"];
/**
 * How a topic is shown: every word capitalised ("Prediction Markets", "AI Agents"), with the usual spelling of
 * names such as DeFi kept. Topics are stored as they are written in TOPICS (and in the database), so matching
 * and saved choices are unchanged; only the label changes.
 */
const SPELLED = new Map(["AI", "DeFi", "DAO", "DAOs", "NFT", "NFTs", "ODR", "RWA", "ZK", "DePIN", "Web3", "UX"].map((w) => [w.toLowerCase(), w]));
const SMALL = new Set(["and", "of", "for", "in", "on", "the", "to", "a"]);
export function topicLabel(topic: string): string {
  return topic.split(/(\s+|-|\/)/).map((w, i) => {
    const lower = w.toLowerCase();
    if (SPELLED.has(lower)) return SPELLED.get(lower)!;
    if (i > 0 && SMALL.has(lower)) return lower;
    return w ? w[0].toUpperCase() + w.slice(1) : w;
  }).join("");
}

export const TOPICS = ["Arbitration", "Jurors", "AI agents", "Prediction markets", "Oracles", "DeFi", "Smart contracts", "Governance", "Legal tech", "Content moderation", "Research", "Community"];
export const REGIONS = ["Europe", "North America", "Latin America", "Asia", "Africa", "Middle East", "Oceania", "Online"];
export const VISITOR_ROLES = ["Builder / developer", "Juror", "Researcher / academic", "Legal professional", "Founder / BD partner", "Investor", "Community member"];

// The one-paragraph story of Kleros, shown in the footer, the "New to Kleros?" strip and event pages.
// Wei Wei's narrative brief (Nov 2026): Kleros as justice and governance infrastructure for the agentic era.
export const KLEROS_TAGLINE = "Kleros is justice and governance infrastructure for the agentic era.";
export const KLEROS_ABOUT =
  `${KLEROS_TAGLINE} When AI agents act, pay and fail at machine speed, Kleros gives people a neutral way to contest what happened and settle it fairly. It powers dispute resolution, reputation, prediction markets and enterprise, with outcomes no single party controls.`;
export const KLEROS_AI_URL = "https://ai.kleros.io";

export interface Product {
  name: string;
  pitch: string;
  url: string;
  cta: string;
  topics: string[];
}

// Shown on each event page, picked by the event's topics.
export const PRODUCTS: Product[] = [
  { name: "Kleros Court", pitch: "Disputes settled by AI triage first, with human jurors deciding the hard cases.", url: "https://kleros.io/earn-become-a-juror", cta: "Become a juror", topics: ["Arbitration", "Jurors", "Legal tech", "Governance"] },
  { name: "Kleros for AI agents", pitch: "Verified agents, protected payments and a court agents can call, at machine speed.", url: "https://ai.kleros.io", cta: "Explore Kleros AI", topics: ["AI agents", "Research"] },
  { name: "Reality.eth + Kleros", pitch: "Optimistic oracle answers backed by Kleros arbitration, used by prediction markets.", url: "https://reality.eth.limo", cta: "Explore the oracle", topics: ["Prediction markets", "Oracles", "DeFi"] },
  { name: "Kleros Escrow", pitch: "Pay for work and goods with a court behind the deal.", url: "https://escrow.kleros.io", cta: "Open an escrow", topics: ["DeFi", "Smart contracts"] },
  { name: "Kleros Curate", pitch: "Community-curated lists and registries, with disputes going to Kleros Court.", url: "https://curate.kleros.io", cta: "Browse registries", topics: ["Content moderation", "Governance", "Community"] },
  { name: "Integrate Kleros", pitch: "Add dispute resolution to your protocol with a few contract calls.", url: "https://docs.kleros.io", cta: "Read the docs", topics: ["Smart contracts", "Oracles", "DeFi"] },
];

export function productsFor(topics: string[], n = 2): Product[] {
  const scored = PRODUCTS.map((p) => ({ p, s: p.topics.filter((t) => topics.includes(t)).length }));
  const hits = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.p);
  return (hits.length ? hits : [PRODUCTS[0], PRODUCTS[5]]).slice(0, n);
}

// The Kleros | Events profile on Luma, where every Kleros-run event takes RSVPs.
export const LUMA_URL = "https://luma.com/user/kleros_io";

// Proof of Presence, the Kleros kickback app: refundable event deposits with Kleros as the referee.
// Points at the review copy until kickback.kleros.io serves the new site; then change it to "https://kickback.kleros.io".
export const KICKBACK_URL = "https://weiwei-ooi.github.io/devcon-side-event-kickback/kickback";
// The kickback site itself, linked from the top-right corner of the header.
export const KICKBACK_SITE = "https://kickback.kleros.io";

export const SOCIALS = [
  { label: "X", url: "https://x.com/kleros_io" },
  { label: "Telegram", url: "https://t.me/kleros" },
  { label: "LinkedIn", url: "https://www.linkedin.com/company/kleros" },
  { label: "Luma", url: LUMA_URL },
  { label: "Reddit", url: "https://www.reddit.com/r/Kleros/" },
  { label: "GitHub", url: "https://github.com/kleros" },
  { label: "Blog", url: "https://blog.kleros.io" },
];

export const MEETING_INTERESTS = ["Integrating Kleros", "Becoming a juror", "Partnership", "Research collaboration", "Press / media", "Speaking invite", "Other"];
