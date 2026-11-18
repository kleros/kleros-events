"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { safeNext } from "@/lib/format";

const loginHref = (next: string) => `/login?next=${encodeURIComponent(safeNext(next))}`;

/** Signs out in this browser only, then opens the sign-in page so another email can be used. */
export default function SwitchAccount({ next, label = "Sign in with another email" }: { next?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr("");
    // "local" keeps the person signed in on their other devices
    const { error } = await supabaseBrowser().auth.signOut({ scope: "local" });
    if (error) { setErr("Could not sign out. Check the connection and try again."); setBusy(false); return; }
    // the assistant's conversation was answered with this account's access
    try { for (const k of Object.keys(sessionStorage)) if (k.startsWith("kleros-ask")) sessionStorage.removeItem(k); } catch { /* storage off */ }
    router.push(loginHref(next ?? window.location.pathname + window.location.search));
    router.refresh();
  }
  return (
    <>
      <button className="btn" type="button" onClick={go} disabled={busy}>{busy ? "Signing out…" : label}</button>
      {err && <span className="note" role="alert">{err}</span>}
    </>
  );
}

/** Sign-in button that brings the person back to the page they are on. */
export function SignInLink({ next }: { next?: string }) {
  const path = usePathname();
  return <Link className="btn primary" href={loginHref(next ?? path)}>Sign in</Link>;
}
