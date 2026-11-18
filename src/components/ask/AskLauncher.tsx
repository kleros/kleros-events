import { currentUser } from "@/lib/supabase/server";
import { sharedLimits, visitorsOff, type Shared } from "@/lib/ask/limit";
import AskWidget, { type TeamNote } from "./AskWidget";

// what the team reads in the panel while only the team can ask: one plain line, and the
// steps to finish the setup folded under it
const SETUP_STEP = "Only the team can use the assistant for now. One more key opens it to visitors.";
const TEAM_ONLY: Record<Exclude<Shared, "ok">, TeamNote> = {
  "no-key": {
    text: SETUP_STEP,
    dev: "In Supabase, open Project Settings, then API Keys, and copy the secret key. On Netlify (Project configuration, Environment variables) and on Vercel (Settings, Environment Variables), add it as SUPABASE_SERVICE_ROLE_KEY, then redeploy. Visitors get the button once the new deploy is live.",
  },
  "not-set-up": {
    text: SETUP_STEP,
    dev: "The database turned the key down. Check that SUPABASE_SERVICE_ROLE_KEY holds the secret key from Supabase (Project Settings, API Keys), not the publishable one, and that 0014_security.sql has been run in the Supabase SQL editor.",
  },
  down: {
    text: "Only the team can use the assistant right now, because the question counter did not answer. Visitors get the button back once it does.",
    dev: "The database that keeps the question counts (ask_take) did not answer. Once it answers, everyone else gets the button on their next page load.",
  },
};

/**
 * The assistant's button, once the deployment has an Anthropic key. Before that only the team
 * sees it, with a note on how to switch it on. Anyone outside the team (visitors, QR guests and
 * other accounts) sees it only while their question counts can be kept in the database
 * (SUPABASE_SERVICE_ROLE_KEY, and ask_take from migration 0013 or 0014); until then the team sees
 * a note on what is missing. ASK_PUBLIC=off keeps it to signed-in accounts.
 */
export default async function AskLauncher() {
  const enabled = !!(process.env.ASK_ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());
  const { user, profile } = await currentUser();
  const isTeam = !!(profile?.is_team || profile?.is_admin);
  if (!enabled && !isTeam) return null;
  if (!user && visitorsOff()) return null;
  const shared = enabled ? await sharedLimits() : "ok";
  if (shared !== "ok" && !isTeam) return null;
  return <AskWidget enabled={enabled} signedIn={!!user} account={user?.id ?? "visitor"} note={shared === "ok" ? undefined : TEAM_ONLY[shared]} />;
}
