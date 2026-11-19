import type { Person } from "@/lib/people";
import Ext from "./Ext";

/** X, LinkedIn and Telegram links of one person, in that order. */
export default function PersonLinks({ p }: { p: Person }) {
  const links = [
    p.x && { label: "X", sub: `@${p.x}`, href: `https://x.com/${p.x}` },
    p.linkedin && { label: "LinkedIn", sub: "", href: p.linkedin },
    p.telegram && { label: "Telegram", sub: `@${p.telegram}`, href: `https://t.me/${p.telegram}` },
  ].filter(Boolean) as { label: string; sub: string; href: string }[];
  if (!links.length) return null;
  return (
    <div className="plinks">
      {links.map((l) => (
        <a key={l.label} className="btn sm" href={l.href} target="_blank" rel="noopener me">
          {l.label}{l.sub && <span className="muted"> {l.sub}</span>}<Ext />
        </a>
      ))}
    </div>
  );
}
