import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false } };

/** Any address the site doesn't have: say so plainly and offer the main ways back in. */
export default function NotFound() {
  return (
    <div className="wrap page con-gate">
      <div className="eyebrow">Page not found</div>
      <h1>This page isn&apos;t here</h1>
      <p className="muted">The link may be old, or the event or talk may have moved. Everything Kleros has been part of is still listed below.</p>
      <div className="row-flex">
        <Link className="btn primary" href="/events">All events</Link>
        <Link className="btn" href="/talks">Talks and recordings</Link>
        <Link className="btn ghost" href="/">Home</Link>
      </div>
    </div>
  );
}
