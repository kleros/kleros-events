import Link from "next/link";
import { currentUser } from "@/lib/supabase/server";
import KlerosLogo from "./KlerosLogo";
import NavLinks from "./NavLinks";

export default async function SiteHeader() {
  const { user, profile } = await currentUser();
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" href="/" aria-label="Kleros Events home">
          <KlerosLogo className="brand-logo" />
          <span className="brand-word">Events</span>
        </Link>
        <NavLinks signedIn={!!user} isTeam={!!profile?.is_team} />
      </div>
    </header>
  );
}
