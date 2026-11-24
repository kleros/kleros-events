import Link from "next/link";
import KlerosLogo from "./KlerosLogo";
import NavLinks from "./NavLinks";

// The same for every visitor: NavLinks fills in the account links in the browser.
export default function SiteHeader() {
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" href="/" aria-label="Kleros Events home">
          <KlerosLogo className="brand-logo" />
          <span className="brand-word">Events</span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
