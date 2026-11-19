import Link from "next/link";
import { peopleIn } from "@/lib/people";
import PersonAvatar from "./PersonAvatar";

/** The Kleros people named in a speaker field, as photo + name + role links to their profiles. */
export default function PersonChips({ speaker, label = "Speaker" }: { speaker: string | null | undefined; label?: string }) {
  const list = peopleIn(speaker);
  if (!list.length) return null;
  return (
    <div className="pchips" aria-label={list.length > 1 ? `${label}s` : label}>
      {list.map((p) => (
        <Link key={p.slug} className="pchip" href={`/people/${p.slug}`}>
          <PersonAvatar person={p} size={36} />
          <span><b>{p.name}</b><span className="muted">{p.role}, Kleros</span></span>
        </Link>
      ))}
    </div>
  );
}
