"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EventRow } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import EventCard from "./EventCard";

/**
 * The signed-in page of the team and of guests added to an internal event. The site keeps nothing else about
 * anyone: no saved items, followed topics or watch history.
 */
export default function MySpace({ email, isTeam, privateEvents, userId }: {
  email: string; isTeam: boolean; privateEvents: EventRow[]; userId: string;
}) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  // for teammates added by hand with a password: they can swap it for one of their own (no email involved)
  async function changePassword(ev: React.FormEvent) {
    ev.preventDefault();
    if (pw.length < 8) { setPwMsg("Use at least 8 characters."); return; }
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setPwMsg(error ? error.message : "Password changed. Use it next time you sign in.");
    if (!error) setPw("");
  }
  async function signOut() {
    await supabaseBrowser().auth.signOut();
    // the assistant's conversation was answered with this account's access
    try { for (const k of Object.keys(sessionStorage)) if (k.startsWith("kleros-ask")) sessionStorage.removeItem(k); } catch { /* storage off */ }
    router.push("/"); router.refresh();
  }

  return (
    <div className="wrap page stack">
      <header className="page-head">
        <div className="eyebrow">{isTeam ? "Kleros team" : "Signed in"}</div>
        <h1>My events</h1>
        <div className="row-flex">
          <span className="muted small">{email}</span>
          <span style={{ flex: 1 }} />
          {isTeam && <Link className="btn sm" href="/admin">Team desk</Link>}
          <button className="btn sm ghost" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <section>
        <div className="section-h first"><div><div className="eyebrow">Private</div><h2>Internal Kleros events</h2></div></div>
        {privateEvents.length > 0
          ? <div className="grid">{privateEvents.map((e) => <EventCard key={e.id} e={e} mine={e.created_by === userId ? "You created this" : isTeam ? "Kleros team" : "Shared with you"} />)}</div>
          : <p className="quiet-empty">{isTeam
            ? <>No internal events yet. Create one from the <Link href="/admin">Team desk</Link>.</>
            : "No internal events are shared with this email address. The public site no longer keeps visitor accounts or saved items, so there is nothing else here. If someone added you to an internal event, ask them to check the address they used."}</p>}
      </section>
      <details className="muted small">
        <summary>Set or change your password</summary>
        <form className="row-flex" onSubmit={changePassword} style={{ marginTop: 8 }}>
          <label htmlFor="new-pw" className="sr-only">New password</label>
          <input id="new-pw" className="search" type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => { setPw(e.target.value); setPwMsg(""); }} />
          <button className="btn sm" type="submit">Save</button>
        </form>
        {pwMsg && <p role="status">{pwMsg}</p>}
      </details>
    </div>
  );
}
