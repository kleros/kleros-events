"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Who is signed in, worked out in the browser so that the server can send the same page to everyone
 * (and the host can keep it ready instead of building it on every click). The session is read from
 * the site's own cookie, with no trip to the database; whether the account is on the team comes from
 * the profile once per sign-in and is remembered for the tab. A QR guest (anonymous session) counts
 * as signed out, as on the server (lib/supabase/server.ts currentUser).
 *
 * Only for showing the right links and labels. Every page and action that needs an account still
 * checks it on the server.
 */
export type Account = { id: string; team: boolean; admin: boolean } | null;

const HINT = "kleros-events:account";
// useLayoutEffect warns when React renders on the server; this hook only reads the hint in the browser
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function readHint(): Account {
  try {
    const raw = sessionStorage.getItem(HINT);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch { return null; }
}
function writeHint(a: Account) {
  try { if (a) sessionStorage.setItem(HINT, JSON.stringify(a)); else sessionStorage.removeItem(HINT); } catch { /* storage off */ }
}

// one lookup shared by the header and the Ask button
let pending: Promise<Account> | null = null;
let known: Account | undefined;
// the last profile lookup failed, so the team flag is a guess
let unsure = false;
const listeners = new Set<(a: Account) => void>();
function publish(a: Account) {
  known = a;
  if (!unsure) writeHint(a);
  listeners.forEach((l) => l(a));
}

async function lookup(): Promise<Account> {
  const sb = supabaseBrowser();
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) return null;
  const hint = unsure ? null : known ?? readHint();
  if (hint && hint.id === user.id) return hint;
  unsure = false;
  // if the profile cannot be read just now, the visitor is still signed in, only without the Team menu
  // (and it is looked up again on the next page)
  const { data: profile, error } = await sb.from("profiles").select("is_team, is_admin").eq("id", user.id).maybeSingle()
    .then((r) => r, (e: unknown) => ({ data: null, error: e }));
  const account = { id: user.id, team: !!profile?.is_team, admin: !!profile?.is_admin };
  if (error) unsure = true;
  return account;
}

function refresh() {
  pending ??= lookup().catch(() => known ?? null).then((a) => { publish(a); return a; }).finally(() => { pending = null; });
  return pending;
}

/** `undefined` until the browser has checked (the first paint after loading a page), then the account or null. */
export function useAccount(): Account | undefined {
  const path = usePathname();
  const [account, setAccount] = useState<Account | undefined>(undefined);
  // before the first paint: what this tab last knew, so a signed-in visitor does not see "Sign in" flash
  useBrowserLayoutEffect(() => {
    const hint = known !== undefined ? known : readHint();
    if (hint) setAccount(hint);
  }, []);
  useEffect(() => {
    listeners.add(setAccount);
    const { data } = supabaseBrowser().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") { known = undefined; writeHint(null); refresh(); }
    });
    return () => { listeners.delete(setAccount); data.subscription.unsubscribe(); };
  }, []);
  // signing in and out ends on another page (a server redirect), so check again on every page change
  useEffect(() => { refresh(); }, [path]);
  return account;
}
