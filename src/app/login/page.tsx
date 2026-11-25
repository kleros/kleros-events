import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";
import { safeNext } from "@/lib/format";

export const metadata: Metadata = { title: "Team sign-in", robots: { index: false } };

// The site is public and has no visitor accounts. Signing in is for the Kleros team (events, uploads, recording,
// internal events) and for guests someone on the team added to an internal event.
const isHost = (next: string) => /\/host(?=[/?#]|$)/.test(next) || /^\/admin\/events\//.test(next);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; failed?: string }> }) {
  const { next: raw, failed } = await searchParams;
  const next = safeNext(raw);
  return (
    <div className="wrap page narrow">
      <div className="eyebrow">Kleros team</div>
      <h1>Team sign-in</h1>
      <p className="lede">For the Kleros team, and for guests added to an internal Kleros event. Everything else on the site, including the talks and the questions for the speakers, works without an account.</p>
      {failed === "1" && (
        <div className="note" role="alert">That sign-in link did not work. It may have expired, been used already, or been opened in a different browser. Enter your email again for a new link, and open it on this same device.</div>
      )}
      <p className="muted small">
        Use your @kleros.io address, the address you were given team access with, or, as a guest, the address you were added to the event with. You get a sign-in link by email, no password needed.
        {isHost(next) && " Invited to run an internal event? Use the email address that was invited."}
      </p>
      <LoginForm next={next} />
    </div>
  );
}
