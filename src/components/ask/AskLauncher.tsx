import { currentUser, supabaseConfigured } from "@/lib/supabase/server";
import { sharedLimits, visitorsOff } from "@/lib/ask/limit";
import { askMode } from "@/lib/ask/mode";
import AskWidget from "./AskWidget";

/**
 * The Ask button, on every page. By default it is a smart search of the site, free and with no
 * key. Where Claude answers are switched on (ASK_PROVIDER=claude, see mode.ts), the team gets them
 * at once and everyone else once their question counts can be kept in the database
 * (SUPABASE_SERVICE_ROLE_KEY and ask_take from migration 0013 or 0014); until then they get the
 * search. ASK_PUBLIC=off keeps Claude answers to signed-in accounts.
 */
export default async function AskLauncher() {
  if (!supabaseConfigured) return null;
  const { user, profile } = await currentUser();
  let ai = false;
  if (askMode() === "claude") {
    const isTeam = !!(profile?.is_team || profile?.is_admin);
    ai = isTeam || ((!!user || !visitorsOff()) && (await sharedLimits()) === "ok");
  }
  return <AskWidget ai={ai} signedIn={!!user} account={user?.id ?? "visitor"} />;
}
