import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";
import { safeNext } from "@/lib/format";

export const metadata: Metadata = { title: "Sign in" };

// Pages only the team (or people invited to a private event) can open.
const isHost = (next: string) => /\/host(?=[/?#]|$)/.test(next) || /^\/admin\/events\//.test(next);
const forTeam = (next: string) => /^\/(admin|record)(?=[/?#]|$)/.test(next) || isHost(next);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; failed?: string }> }) {
  const { next: raw, failed } = await searchParams;
  const next = safeNext(raw);
  return (
    <div className="wrap page narrow">
      <div className="eyebrow">My events</div>
      <h1>Sign in</h1>
      <p className="lede">Save events, keep private notes and pick up talks where you left off. Watching talks and asking the speakers questions work without an account. Enter an email address to get a sign-in link. No password needed.</p>
      {failed === "1" && (
        <div className="note" role="alert">That sign-in link did not work. It may have expired, been used already, or been opened in a different browser. Enter your email again for a new link, and open it on this same device.</div>
      )}
      {forTeam(next) && (
        <p className="muted small">
          Team sign-in: use your @kleros.io address, or the email address you were given access with.
          {isHost(next) && " Invited to run a private event? Use the email address that was invited."}
        </p>
      )}
      <LoginForm next={next} />
    </div>
  );
}
