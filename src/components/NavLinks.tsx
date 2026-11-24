"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KICKBACK_SITE } from "@/lib/kleros";
import Ext from "./Ext";
import ThemeToggle, { ThemeChoice } from "./ThemeToggle";
import { useAccount } from "@/lib/useAccount";

/** Header navigation. Desktop: Events and Talks, then account, theme and Kickback on the right.
 *  Phones: Kickback and a Menu sheet that holds the rest.
 *  The account links are filled in by the browser (lib/useAccount.ts), so every page can be sent ready-made. */
export default function NavLinks() {
  const path = usePathname();
  const acct = useAccount();
  const signedIn = !!acct;
  const isTeam = !!acct?.team;
  // until the browser has checked, the account link keeps its place but is not shown
  const checking = acct === undefined;
  const on = (href: string) => (path === href || path.startsWith(href + "/") ? "page" : undefined);
  const team = useRef<HTMLDetailsElement>(null);
  const sheet = useRef<HTMLDetailsElement>(null);

  // the Team menu and the phone sheet close on navigation, on a tap outside, on Escape and when the focus leaves them
  useEffect(() => {
    for (const d of [team.current, sheet.current]) if (d) d.open = false;
  }, [path]);
  useEffect(() => {
    const menus = () => [team.current, sheet.current].filter((d): d is HTMLDetailsElement => !!d && d.open);
    const down = (e: PointerEvent) => {
      for (const d of menus()) if (!d.contains(e.target as Node)) d.open = false;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      for (const d of menus()) {
        d.open = false;
        d.querySelector("summary")?.focus();
      }
    };
    // tabbing out of an open menu closes it, so it does not cover what has the focus
    const focus = (e: FocusEvent) => {
      for (const d of menus()) if (!d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    document.addEventListener("focusin", focus);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
      document.removeEventListener("focusin", focus);
    };
  }, []);
  // a link to the page already open does not change the path: close the panel anyway
  const closeOnLink = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a")) e.currentTarget.closest("details")?.removeAttribute("open");
  };

  const account = signedIn ? { href: "/me", label: "My events" } : { href: "/login", label: "Sign in" };
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-main">
        <Link className="nav-link" href="/events" aria-current={on("/events")}>Events</Link>
        <Link className="nav-link" href="/talks" aria-current={on("/talks")}>Talks</Link>
        <Link className="nav-link" href="/people" aria-current={on("/people")}>People</Link>
      </div>
      <div className="nav-end">
        {/* everyone signed in keeps a Saved list; only @kleros.io accounts get the Team menu */}
        {signedIn && <Link className="nav-link wide" href="/saved" aria-current={on("/saved")}>Saved</Link>}
        {isTeam ? (
          <details className="menu end acct wide" ref={team}>
            <summary className="nav-link">Team<span aria-hidden="true"> ▾</span></summary>
            <div className="menu-panel" onClick={closeOnLink}>
              <Link href="/admin" aria-current={on("/admin")}>Team desk</Link>
              <Link href="/me" aria-current={on("/me")}>My events</Link>
            </div>
          </details>
        ) : (
          <Link className="nav-link wide" href={account.href} aria-current={on(account.href)} style={checking ? { visibility: "hidden" } : undefined}>{account.label}</Link>
        )}
        <ThemeToggle className="wide" />
        <a className="btn sm nav-kickback" href={KICKBACK_SITE} target="_blank" rel="noopener">Kickback<Ext /></a>
        <details className="menu end nav-sheet" ref={sheet}>
          <summary className="icon-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            <span className="sr-only">Menu</span>
          </summary>
          <div className="menu-panel" onClick={closeOnLink}>
            <Link href="/events" aria-current={on("/events")}>Events</Link>
            <Link href="/talks" aria-current={on("/talks")}>Talks</Link>
            <Link href="/people" aria-current={on("/people")}>People</Link>
            {signedIn && <Link href="/saved" aria-current={on("/saved")}>Saved</Link>}
            <Link href={account.href} aria-current={on(account.href)}>{account.label}</Link>
            {isTeam && <Link href="/admin" aria-current={on("/admin")}>Team desk</Link>}
            <ThemeChoice />
          </div>
        </details>
      </div>
    </nav>
  );
}
