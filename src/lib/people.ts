/**
 * Kleros people who speak or meet visitors at events, each with a page at /people/<slug>.
 * Names, roles and handles come from the Kleros team directory (Notion) and the people's own
 * public X and LinkedIn profiles. Only public links go here: this file is in a public repo.
 * Developers who do not speak at events are left out on purpose (Wei Wei, 2026-11-19).
 *
 * Speaker names on talks, files and agendas link here when they match a name or an alias.
 */
export interface Person {
  slug: string;
  name: string;
  role: string;
  /** one or two plain sentences, no marketing-speak */
  bio?: string;
  /** X handle without @; also the source of the profile photo */
  x?: string;
  linkedin?: string;
  telegram?: string;
  /** other spellings used in speaker fields */
  aliases?: string[];
  /** earlier page addresses, which redirect to the current one */
  oldSlugs?: string[];
}

export const PEOPLE: Person[] = [
  {
    slug: "federico-ast", name: "Federico Ast", role: "Co-founder & CEO",
    bio: "Co-founded Kleros and speaks on decentralized justice, governance and the legal side of blockchains.",
    x: "federicoast", linkedin: "https://www.linkedin.com/in/federicoast/",
  },
  {
    slug: "clement-lesaege", name: "Clément Lesaege", role: "Co-founder & CTO",
    bio: "Co-founded Kleros and leads its technology, from the court's game theory to prediction markets and AI agents.",
    x: "clesaege", aliases: ["Clement Lesaege"],
  },
  {
    slug: "william-george", name: "William George", role: "Research Director",
    bio: "Leads Kleros research on mechanism design, juror incentives and dispute resolution.",
    x: "williamhwgeorge", linkedin: "https://www.linkedin.com/in/william-george-128bab148/",
  },
  {
    slug: "fortunato", name: "Fortunato", role: "Lead Product Manager", oldSlugs: ["fortunato-cinquepalmi"],
    x: "fortuvp", linkedin: "https://www.linkedin.com/in/fortunato-andrea-cinquepalmi-52b57887/",
    aliases: ["Fortunato Andrea Cinquepalmi", "Fortunato Cinquepalmi"],
  },
  {
    slug: "0xalex", name: "0xAlex", role: "Business Development Lead",
    x: "alex__eth", aliases: ["Alexandre (0xAlex)", "Alexandre"], oldSlugs: ["alexandre"],
  },
  {
    slug: "juanrah", name: "JuanRah", role: "Oracle Lead, Business Development",
    x: "JuanRah", linkedin: "https://www.linkedin.com/in/juan-ramiro-garza/",
    aliases: ["Juan Ramiro Garza Quintanilla", "Juan Ramiro Garza"], oldSlugs: ["juan-ramiro-garza"],
  },
  {
    slug: "facundo-trotz", name: "Facundo Trotz", role: "Policy Writer",
    x: "facundo_trotz", linkedin: "https://www.linkedin.com/in/facundotrotz/",
  },
  {
    slug: "lucia-bocalandro", name: "Lucía Bocalandro", role: "Business Development",
    x: "LuBocalandro", linkedin: "https://www.linkedin.com/in/luciabocalandro/", aliases: ["Lucia Bocalandro"],
  },
  {
    slug: "parul-yadav", name: "Parul Yadav", role: "Developer Relations",
    linkedin: "https://www.linkedin.com/in/parulyadav18/",
  },
  {
    slug: "juan-samitier", name: "Juan Samitier", role: "Finance Manager",
    x: "JuanSamitier", linkedin: "https://www.linkedin.com/in/juan-samitier-47b4321a5/",
  },
  {
    slug: "weiwei", name: "Wei Wei", role: "Event Manager", aliases: ["Wei Wei Ooi", "Weiwei"], oldSlugs: ["wei-wei-ooi"],
    bio: "Runs Kleros at events: booths, side events, workshops and the team's schedule on the ground. The person to talk to about bringing Kleros to your event.",
    x: "weiwei_ooi", linkedin: "https://www.linkedin.com/in/ooiweiwei/",
  },
];

export const personBySlug = (slug: string) => PEOPLE.find((p) => p.slug === decodeURIComponent(slug));
/** the person an earlier address belonged to, for a redirect */
export const personByOldSlug = (slug: string) => PEOPLE.find((p) => p.oldSlugs?.includes(decodeURIComponent(slug)));

/** lower case without accents, one output character per input character so positions line up */
const fold = (s: string) => Array.from(s, (c) => {
  const g = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return g.length === c.length ? g : c;
}).join("");

const NAMES = PEOPLE.flatMap((p) => [p.name, ...(p.aliases ?? [])].map((n) => ({ key: fold(n), p })))
  // longest first, so "Alexandre (0xAlex)" wins over "0xAlex"
  .sort((a, b) => b.key.length - a.key.length);

export type SpeakerPart = { text: string; person?: Person };

/**
 * Splits a speaker field ("Federico Ast and William George") into plain text and known people,
 * in order, so the names can link to their pages. Matches whole words only.
 */
export function speakerParts(s: string | null | undefined): SpeakerPart[] {
  if (!s) return [];
  const f = fold(s);
  const parts: SpeakerPart[] = [];
  let i = 0, plain = "";
  const wordEdge = (k: number) => k < 0 || k >= f.length || !/[\p{L}\p{N}]/u.test(f[k]);
  while (i < s.length) {
    const hit = wordEdge(i - 1) ? NAMES.find((n) => f.startsWith(n.key, i) && wordEdge(i + n.key.length)) : undefined;
    if (hit) {
      if (plain) parts.push({ text: plain }), (plain = "");
      parts.push({ text: s.slice(i, i + hit.key.length), person: hit.p });
      i += hit.key.length;
    } else plain += s[i++];
  }
  if (plain) parts.push({ text: plain });
  return parts;
}

/** The known people named in a speaker field. */
export const peopleIn = (s: string | null | undefined) => {
  const seen = new Set<string>();
  return speakerParts(s).flatMap((x) => (x.person && !seen.has(x.person.slug) && seen.add(x.person.slug) ? [x.person] : []));
};

export const photoUrl = (p: Person) => (p.x ? `/people/${p.slug}/photo` : null);
export const initials = (name: string) => name.replace(/\(.*?\)/g, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
