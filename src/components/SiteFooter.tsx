import Link from "next/link";
import { KLEROS_AI_URL, KLEROS_TAGLINE, SOCIALS } from "@/lib/kleros";
import Ext from "./Ext";
import KlerosLogo from "./KlerosLogo";
import { ThemeChoice } from "./ThemeToggle";

const NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;

export default function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="about">
          <KlerosLogo className="brand-logo" />
          {/* the one-line tagline: the homepage and event pages already give the full story just above */}
          <p>{KLEROS_TAGLINE}</p>
          <p className="foot-links">
            <a href="https://kleros.io" target="_blank" rel="noopener">Explore Kleros<Ext /></a> · <a href={KLEROS_AI_URL} target="_blank" rel="noopener">Kleros for AI agents<Ext /></a>
          </p>
        </div>
        <div>
          <h2 className="foot-h">Kleros</h2>
          <a href="https://kleros.io" target="_blank" rel="noopener">kleros.io{NEW_TAB}</a>
          <a href={KLEROS_AI_URL} target="_blank" rel="noopener">Kleros AI{NEW_TAB}</a>
          <a href="https://court.kleros.io" target="_blank" rel="noopener">Court{NEW_TAB}</a>
          <a href="https://docs.kleros.io" target="_blank" rel="noopener">Docs{NEW_TAB}</a>
          <a href="https://blog.kleros.io" target="_blank" rel="noopener">Blog{NEW_TAB}</a>
        </div>
        <div>
          <h2 className="foot-h">Follow</h2>
          {SOCIALS.filter((s) => s.label !== "Blog").map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener">{s.label}{NEW_TAB}</a>)}
        </div>
        <div className="base">
          <span>Want Kleros at your event? <Link href="/contact">Get in touch</Link> · <Link href="/kickback">Run your own kickback event</Link> </span>
          <span className="foot-end"><Link href="/login" rel="nofollow">Team sign-in</Link><ThemeChoice /></span>
        </div>
      </div>
    </footer>
  );
}
