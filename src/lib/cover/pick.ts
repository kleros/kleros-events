import type { EventRow } from "@/lib/types";

/*
 * Which picture an event shows. In order of preference: the event's own poster or key art (from its website or
 * Luma), an existing Kleros visual, else the designed Kleros cover (./tree). Never a screenshot of a social post
 * or a "Kleros is sponsoring" announcement graphic.
 */

/** A picture and how it sits in the event's tile (components/EventTile.tsx): whole (the default), or cropped. */
export type Cover = {
  src: string;
  /** "cover" crops the picture to a 4:3 window instead of showing it whole; for a tall poster that would be a sliver */
  fit?: "cover";
  /** object-position when cropped, e.g. "top" to keep a tall poster's title */
  position?: string;
  /** a colour behind the picture, for a poster with a see-through background */
  bg?: string;
};

/**
 * Picked by hand, slug -> the picture, or null for the designed cover. Comes first, ahead of cover_path. Every
 * picture here was looked at (18 Nov 2026) and is the event's own poster or key art, or a designed Kleros
 * visual, so it may sit on any https host: a few clean posters are only published as files on X or YouTube.
 * null marks events whose only pictures are social screenshots, photos, video frames or images too small to use.
 * Events not listed here follow cover_path through the host check below (kept Luma and official-site covers).
 */
export const OFFICIAL: Record<string, string | Cover | null> = {
  // the organiser's poster or key art
  "stanford-blockchain-governance-summit-2025": "https://images.lumacdn.com/event-covers/2x/f66baba0-483d-4250-8803-d2d959b83fcf.png",
  "eth-cluj-2025": "https://images.lumacdn.com/event-covers/yl/e4e7a4c2-ee0c-484c-9bf2-4ab53bd421ae.png",
  "ethcc-8-cannes-2025": "https://ethcc.io/_next/static/media/ethcc8.e51d8494.jpg",
  "blockchaingov-symposium-paris-2025": "https://images.lumacdn.com/event-covers/ff/aa98f79d-3d18-45ea-997f-282482aa07a9.png",
  "devconnect-legal-scholars-program-2025": "https://storage.googleapis.com/ethereum-hackmd/upload_cdacb108dd9be2e5b893c6449b70999e.jpg",
  "argentina-onchain-edge-city-patagonia-2025": "https://substack-post-media.s3.amazonaws.com/public/images/4797c18d-484d-440e-82b2-8e7d9220eb04_1920x1080.jpeg",
  "devconnect-buenos-aires-2025": "https://devconnect.org/og-argentina.png?reset=1",
  "blockchain-oracle-summit-buenos-aires-2025": "https://assets.blocklive.io/events/766ba489-878b-4e68-a7be-80a9b5f97659/86ac52ff-f12d-4bec-95e7-c56fbe413d03_deficonnect__2_.png",
  "ethcon-argentina-2025": "https://assets.iproup.com/assets/jpg/2025/09/44119_landscape.jpg",
  "neuchatel-blockchain-dispute-resolution-2025": "https://pbs.twimg.com/media/Gq1WGl2WMAAZatp?format=jpg&name=large",
  "champagnat-blockchain-justicia-mendoza-2025": "https://pbs.twimg.com/media/G2CCc16WkAE8nlC?format=jpg&name=large",
  "ethcc-9-cannes-2026": "https://dl-migration-assets.s3.eu-central-1.amazonaws.com/images/1772112487743.webp",
  "forecast-and-coffee-berkeley-2026": "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,background=white,quality=75,width=400,height=400/uploads/8g/6b538be7-5f21-42d1-a87c-a55a8755f899.png",
  "austral-derecho-tecnologia-congreso-2026": { src: "https://abogados.com.ar/assets/img/articulos/2026-08-24-110521-segundo-congreso-internacional-de-derecho-y-tecnologia-3-y-4-septiembre-1.jpg", fit: "cover", position: "top" },
  "ethtaipei-2026": "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,background=white,quality=75,width=400,height=400/uploads/8u/2f66bc60-6ba7-4c92-be0c-72c15291df52.jpg",
  "token2049-singapore-2026": "https://cdn.prod.website-files.com/6756df8f05088bc3e51c64c0/6a9e828d9aa96c64f392c993_T2049%20Singapore%20-%20OpenGraph%20(2026)%202%20OCT%202025.jpeg",
  "4s-toronto-2026": "https://4sonline.org/photos/ConferencePageBannerToronto2026_12092025192656.JPG",
  "who-judges-the-machines-buenos-aires-2026": "https://serv1.evento-simple.com/imagenes/productores/661/eventos/77/image_xl.png",
  "merge-madrid-2026": "https://www.mmerge.io/img/social_2026.jpg",
  "devcon-8-mumbai": "https://www.devcon.org/assets/images/new-og.jpg",
  // the organiser's poster with the name, the 4 Seas and sponsor logos (X, 5 Nov 2026); the site itself only has the backdrop
  "ethchiangmai-chiang-mai-2026": "https://pbs.twimg.com/media/HWWieEtWwAAlrOJ?format=jpg&name=large",
  "ethcc-10-cannes-2027": { src: "https://ethcc.io/ethcc-10-og.png", bg: "#FFFFFF" },

  // a designed Kleros visual for the event (blog header, webinar poster)
  "from-idea-to-impact-legaltech-workshop-2025": "https://storage.ghost.io/c/a6/22/a6222a4e-2e35-45bd-99bd-553de64e73e7/content/images/size/w1200/2025/02/Blog-header_A-Hands-On-Workshop-for-LegalTech-Founders-1.png",
  "curation-webinar-2025": "https://i.ytimg.com/vi/S2QowNkxWoc/maxresdefault.jpg",
  "cifile-webinar-crowds-and-algorithms-2026": "https://pbs.twimg.com/media/HASN6ioXYAM6pxQ?format=jpg&name=large",
  "justicia-descentralizada-en-accion-webinar-2026": "https://i.ytimg.com/vi/VG-h95Ap-5M/maxresdefault.jpg",

  // no usable picture: the designed Kleros cover
  "externado-legal-innovation-workshop-2025": null,
  "university-of-manchester-talk-2025": null,
  "merge-buenos-aires-2025": null,
  "odr-forum-london-2025": null,
  "crypto-arbitration-forum-zurich-2025": null,
  "assas-legaltech-class-2025": null,
  "ierr-demo-day-2025": null,
  "abogados-del-futuro-lima-2025": null,
  "up-guadalajara-masterclass-2025": null,
  "colorado-online-dispute-systems-workshop-2026": null,
  "icc-france-crypto-arbitration-paris-2026": null,
  "kleros-ai-uk-tour-kings-college-2026": null,
  "subtech-buenos-aires-2026": null,
};

/**
 * cover_path URLs never to show, for pictures the host check below lets through (announcement graphics). Matched on
 * scheme, host and path, so a different letter case in the host or an added query string still matches.
 */
export const REJECTED: ReadonlySet<string> = new Set<string>([
  // "https://…",
]);

// pictures from social posts: their own hosts and the CDNs that serve them
const SOCIAL_HOSTS = [
  "twimg.com", "x.com", "twitter.com", "t.co",
  "ytimg.com", "youtube.com", "youtu.be",
  "licdn.com", "linkedin.com",
  "fbcdn.net", "facebook.com", "cdninstagram.com", "instagram.com",
  "substack.com", "substackcdn.com", "substack-post-media.s3.amazonaws.com",
  "t.me", "telesco.pe",                          // and any host with "telegram" in it, below
];

function isSocialHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h.includes("telegram") || SOCIAL_HOSTS.some((d) => h === d || h.endsWith("." + d));
}

/** A plain https URL: no other scheme, no user name or password in it. */
function httpsUrl(s: string | null | undefined): URL | null {
  try {
    const u = new URL((s ?? "").trim());
    return u.protocol === "https:" && !!u.hostname && !u.username && !u.password ? u : null;
  } catch {
    return null;
  }
}

const sameImage = (u: URL) => u.origin + u.pathname;
const rejected = new Set(Array.from(REJECTED, (s) => { const u = httpsUrl(s); return u ? sameImage(u) : s; }));
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * The picture to show for an event and how to frame it, or null for the designed Kleros cover: the hand-picked
 * entry when there is one (null included), else cover_path when it is a plain https URL off the social hosts and
 * not rejected. URLs come back normalized (lower-case scheme and host, spaces encoded), so every place that prints
 * or loads one reads it the same way.
 */
export function coverPick(e: Pick<EventRow, "slug" | "cover_path">): Cover | null {
  if (has(OFFICIAL, e.slug)) {
    const p = OFFICIAL[e.slug];
    if (p === null) return null;
    const c = typeof p === "string" ? { src: p } : p;
    const u = httpsUrl(c.src);
    if (u) return { ...c, src: u.href };
    // a mistyped entry falls through to cover_path
  }
  const u = httpsUrl(e.cover_path);
  return u && !isSocialHost(u.hostname) && !rejected.has(sameImage(u)) ? { src: u.href } : null;
}

/** Just the picture's URL (sitemap), or null for the designed cover. */
export function coverImage(e: Pick<EventRow, "slug" | "cover_path">): string | null {
  return coverPick(e)?.src ?? null;
}
