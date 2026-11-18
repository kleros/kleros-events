"use client";
import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * A page that failed to load (the database did not answer, a list could not be read): say so
 * plainly instead of showing an empty list, and offer a retry. The details go to the console.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="wrap page con-gate">
      <div className="eyebrow">Something went wrong</div>
      <h1>This page could not load</h1>
      <p className="muted">The events did not load just now. Try again in a minute.</p>
      <div className="row-flex">
        {/* the error came from the server, so fetch the page again before rendering it again */}
        <button className="btn primary" onClick={() => startTransition(() => { router.refresh(); reset(); })}>Try again</button>
        <Link className="btn" href="/">Home</Link>
      </div>
    </div>
  );
}
