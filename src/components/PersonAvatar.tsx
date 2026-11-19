"use client";
import { useEffect, useRef, useState } from "react";
import { initials, type Person } from "@/lib/people";

/** A round profile photo that falls back to the person's initials. */
export default function PersonAvatar({ person, size = 40 }: { person: Pick<Person, "slug" | "name" | "x">; size?: number }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  const src = person.x ? `/people/${person.slug}/photo` : null;
  return (
    <span className="pav" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {src && !failed
        // eslint-disable-next-line @next/next/no-img-element
        ? <img ref={ref} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
        : initials(person.name)}
    </span>
  );
}
