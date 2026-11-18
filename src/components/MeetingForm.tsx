"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MEETING_INTERESTS } from "@/lib/kleros";
import { visitorError } from "@/lib/visitorError";

/** startOpen shows the form at once (the contact page); defaultInterest preselects the topic. */
export default function MeetingForm({ eventId, startOpen = false, defaultInterest }: { eventId: string | null; startOpen?: boolean; defaultInterest?: string }) {
  const [open, setOpen] = useState(startOpen);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  const done = useRef<HTMLDivElement>(null);
  // the form goes away once it is sent: move focus to the thank-you line instead of losing it
  useEffect(() => { if (state === "sent") done.current?.focus(); }, [state]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    const { error } = await supabaseBrowser().from("meeting_requests").insert({
      event_id: eventId, name: String(f.get("name")), email: String(f.get("email")), company: String(f.get("company") || "") || null,
      interest: String(f.get("interest")), message: String(f.get("message") || "") || null,
    });
    if (error) { setErr(visitorError(error, "The request")); setState("error"); return; }
    setState("sent");
  }

  if (state === "sent") return <div className="ok" role="status" ref={done} tabIndex={-1}>Thanks. The Kleros team will reply by email.</div>;
  if (!open) return <button className="btn sm" onClick={() => setOpen(true)}>Request a meeting</button>;
  return (
    <form onSubmit={submit} className="stack form-tight">
      <div className="field"><label htmlFor="mr-name">Name</label><input id="mr-name" name="name" autoComplete="name" required autoFocus={!startOpen} /></div>
      <div className="field"><label htmlFor="mr-email">Email</label><input id="mr-email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="mr-company">Company or project</label><input id="mr-company" name="company" autoComplete="organization" /></div>
      <div className="field"><label htmlFor="mr-interest">I&apos;d like to talk about</label><select id="mr-interest" name="interest" defaultValue={defaultInterest}>{MEETING_INTERESTS.map((i) => <option key={i}>{i}</option>)}</select></div>
      <div className="field"><label htmlFor="mr-msg">Anything else</label><textarea id="mr-msg" name="message" /></div>
      {state === "error" && <div className="note" role="alert">Not sent. {err}</div>}
      <button className="btn primary sm" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send request"}</button>
    </form>
  );
}
