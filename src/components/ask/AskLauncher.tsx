import { supabaseConfigured } from "@/lib/supabase/server";
import { sharedLimits, visitorsOff } from "@/lib/ask/limit";
import { askMode } from "@/lib/ask/mode";
import AskWidget, { type AiFor } from "./AskWidget";

/**
 * The Ask button, on every page. By default it is a smart search of the site, free and with no
 * key. Where Claude answers are switched on (ASK_PROVIDER=claude, see mode.ts), the team gets them
 * at once and everyone else once their question counts can be kept in the database
 * (SUPABASE_SERVICE_ROLE_KEY and ask_take from migration 0013 or 0014); until then they get the
 * search. ASK_PUBLIC=off keeps Claude answers to signed-in accounts.
 *
 * Nothing here depends on who is looking (the widget works that out in the browser), so pages stay
 * the same for everyone and can be served ready-made. /api/ask decides again for every question.
 */
export default async function AskLauncher() {
  if (!supabaseConfigured) return null;
  let aiFor: AiFor = { team: false, signedIn: false, visitor: false };
  if (askMode() === "claude") {
    const shared = (await sharedLimits()) === "ok";
    aiFor = { team: true, signedIn: shared, visitor: shared && !visitorsOff() };
  }
  return <AskWidget aiFor={aiFor} />;
}
