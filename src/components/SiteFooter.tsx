import Link from "next/link";
import { LUMA_URL, SOCIALS } from "@/lib/kleros";

export default function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="about">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kleros-logo.svg" alt="Kleros" />
          <p>Kleros is an on-chain dispute resolution protocol. Randomly drawn jurors rule on cases, from escrow disputes to disagreements between AI agents.</p>
        </div>
        <div>
          <h2 className="foot-h">Events</h2>
          <Link href="/events?when=upcoming">Upcoming</Link>
          <Link href="/events?when=past">Past</Link>
          <Link href="/talks">Talks</Link>
          <Link href="/me">My events</Link>
        </div>
        <div>
          <h2 className="foot-h">Kleros</h2>
          <a href="https://kleros.io" target="_blank" rel="noopener">kleros.io</a>
          <a href="https://court.kleros.io" target="_blank" rel="noopener">Court</a>
          <a href="https://docs.kleros.io" target="_blank" rel="noopener">Docs</a>
          <a href="https://blog.kleros.io" target="_blank" rel="noopener">Blog</a>
        </div>
        <div>
          <h2 className="foot-h">Follow</h2>
          {SOCIALS.filter((s) => s.label !== "Blog").map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener">{s.label}</a>)}
        </div>
        <div className="base">
          <span>Kleros Events</span>
          <span>Want Kleros at your event? <Link href="/contact">Get in touch</Link> · <a href={LUMA_URL} target="_blank" rel="noopener">All events on Luma</a></span>
        </div>
      </div>
    </footer>
  );
}
