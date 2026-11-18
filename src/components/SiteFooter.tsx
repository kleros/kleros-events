import Link from "next/link";
import { SOCIALS } from "@/lib/kleros";
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
          <p>Kleros is a decentralized court: randomly drawn jurors review the evidence and settle disputes on-chain, with appeals to larger juries.</p>
          <p className="foot-links">
            <a href="https://kleros.io" target="_blank" rel="noopener">How it works<Ext /></a> · <a href="https://court.kleros.io" target="_blank" rel="noopener">Become a juror<Ext /></a>
          </p>
        </div>
        <div>
          <h2 className="foot-h">Kleros</h2>
          <a href="https://kleros.io" target="_blank" rel="noopener">kleros.io{NEW_TAB}</a>
          <a href="https://court.kleros.io" target="_blank" rel="noopener">Court{NEW_TAB}</a>
          <a href="https://docs.kleros.io" target="_blank" rel="noopener">Docs{NEW_TAB}</a>
          <a href="https://blog.kleros.io" target="_blank" rel="noopener">Blog{NEW_TAB}</a>
        </div>
        <div>
          <h2 className="foot-h">Follow</h2>
          {SOCIALS.filter((s) => s.label !== "Blog").map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener">{s.label}{NEW_TAB}</a>)}
        </div>
        <div className="base">
          <span>Want Kleros at your event? <Link href="/contact">Get in touch</Link> · <Link href="/kickback">Run your own kickback event</Link></span>
          <ThemeChoice />
        </div>
      </div>
    </footer>
  );
}
