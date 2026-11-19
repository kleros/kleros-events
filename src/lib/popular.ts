import type { Material } from "./types";
import { sameTalk } from "./related";

export type TalkStats = Record<string, { views: number; likes: number | null }>;

/** A like says more than a view: few people press it, so one counts as ten views. */
export const attention = (s: { views: number; likes: number | null }) => s.views + 10 * (s.likes ?? 0);

/** "1.2K views · 45 likes" for a talk card. */
export function statsLine(s: { views: number; likes: number | null } | undefined): string | undefined {
  if (!s || !s.views) return undefined;
  const n = (x: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(x);
  return [`${n(s.views)} ${s.views === 1 ? "view" : "views"}`, s.likes ? `${n(s.likes)} ${s.likes === 1 ? "like" : "likes"}` : ""].filter(Boolean).join(" · ");
}

/**
 * The talks that drew the most attention on YouTube (views, and likes counted more), one copy of a talk posted
 * twice, from `talks` (which the caller has already limited to talks the visitor may see).
 */
export function mostWatched(talks: Material[], stats: TalkStats, n = 3, skip: Set<string> = new Set()): Material[] {
  const seen = new Set<string>();
  return talks.filter((m) => stats[m.id]?.views && !skip.has(m.id))
    .sort((a, b) => attention(stats[b.id]) - attention(stats[a.id]))
    .filter((m) => { const k = sameTalk(m.title); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, n);
}
