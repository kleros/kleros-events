"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const links = [
    { href: "/admin", label: "Events and requests", on: path === "/admin" || path.startsWith("/admin/events") },
    { href: "/record", label: "Record", on: path === "/record" },
    { href: "/admin/recordings", label: "All recordings", on: path.startsWith("/admin/recordings") },
    { href: "/admin/team", label: "Kleros people", on: path.startsWith("/admin/team") },
    ...(isAdmin ? [{ href: "/admin/access", label: "Who can sign in", on: path.startsWith("/admin/access") }] : []),
  ];
  return (
    <nav className="adm-nav" aria-label="Team area">
      <div className="wrap">
        <span className="eyebrow" title="Only people signed in with a @kleros.io email see this area">Team area · Kleros accounts only</span>
        <div className="seg">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={l.on ? "page" : undefined}>{l.label}</Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
