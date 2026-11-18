import type { ReactNode } from "react";

// http(s) addresses and bare www. ones, up to the next space or quote
const ADDRESS = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const count = (s: string, c: string) => s.split(c).length - 1;

/** Drops a full stop, comma or closing bracket that ends the sentence rather than the address. */
function trim(url: string) {
  while (/[.,;:!?)\]]$/.test(url)) {
    // a bracket the address opened itself stays: en.wikipedia.org/wiki/Kleros_(protocol)
    if (url.endsWith(")") && count(url, "(") >= count(url, ")")) break;
    url = url.slice(0, -1);
  }
  return url;
}

/** How an address reads on the page: no https://, no query string, no trailing slash. */
function shown(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/\?.*$/, "").replace(/\/$/, "");
}

/**
 * Plain text with its web addresses turned into links that open in a new tab. Long tracking
 * links from Luma descriptions read as a short address; the full one is in the tooltip.
 */
export default function Linkify({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(ADDRESS)) {
    const url = trim(m[0]);
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    out.push(<a key={at} href={href} target="_blank" rel="noopener nofollow" title={href}>{shown(url) || url}</a>);
    last = at + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
