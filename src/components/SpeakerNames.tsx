import Link from "next/link";
import { speakerParts } from "@/lib/people";

/**
 * A speaker field with each Kleros person linked to their profile. Server-safe. Inside a card
 * whose title link stretches over it, the names sit above that link (.spk a) so they stay clickable.
 */
export default function SpeakerNames({ speaker }: { speaker: string | null | undefined }) {
  const parts = speakerParts(speaker);
  if (!parts.length) return null;
  return (
    <span className="spk">
      {parts.map((p, i) => (p.person
        ? <Link key={i} href={`/people/${p.person.slug}`}>{p.person.name}</Link>
        : <span key={i}>{p.text}</span>))}
    </span>
  );
}
