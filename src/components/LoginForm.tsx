"use client";
import { useEffect, useRef, useState } from "react";
import type { AuthError } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { captchaToken } from "@/lib/turnstile";

// Supabase allows one link per address about every minute; the button waits the same time.
const WAIT_MS = 60_000;

function friendly(error: AuthError) {
  if (error.status === 429 || /rate limit|only request this after|security purposes/i.test(error.message)) {
    return "A link was sent a moment ago. Wait a minute before asking for another.";
  }
  if (/fetch|network/i.test(error.message)) return "Could not reach the sign-in service. Check the connection and try again.";
  return error.message;
}

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const wait = sentAt ? Math.max(0, Math.ceil((sentAt + WAIT_MS - now) / 1000)) : 0;

  // ticks once a second until "Send again" can be used
  useEffect(() => {
    if (!sentAt) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n - sentAt >= WAIT_MS) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [sentAt]);

  async function send() {
    setBusy(true); setErr("");
    let token: string | undefined;
    try { token = await captchaToken("sign_in"); }
    catch (e) { setBusy(false); setErr((e as Error).message); return false; }
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`, captchaToken: token },
    });
    setBusy(false);
    if (error) { setErr(friendly(error)); return false; }
    const t = Date.now();
    setSentAt(t); setNow(t);
    return true;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await send()) { setSent(true); setResent(false); }
  }
  async function again() {
    if (await send()) setResent(true);
  }
  function another() {
    setSent(false); setResent(false); setErr(""); setEmail("");
    // the input is back on the next render
    setTimeout(() => input.current?.focus(), 0);
  }

  if (sent) {
    return (
      <div className="stack">
        <div className="ok" role="status">
          {resent ? `A new link is on its way to ${email}. Use the link in the newest email.` : `Check ${email} for your sign-in link.`}
        </div>
        <p className="muted small" style={{ margin: 0 }}>Open the link on this device, in this browser. Nothing after a minute? Check spam.</p>
        {err && <div className="note" role="alert">{err}</div>}
        <div className="row-flex">
          <button className="btn" type="button" onClick={again} disabled={busy || wait > 0}>
            {busy ? "Sending…" : wait > 0 ? `Send again in ${wait}s` : "Send again"}
          </button>
          <button className="btn ghost" type="button" onClick={another} disabled={busy}>Use another email</button>
        </div>
      </div>
    );
  }
  return (
    <form className="panel" onSubmit={submit}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input ref={input} id="email" type="email" autoComplete="email" enterKeyHint="send" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {err && <div className="note" role="alert">{err}</div>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
