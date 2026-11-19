"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { visitorError } from "@/lib/visitorError";

const KINDS = [
  { v: "Speaking invite", label: "Invite Kleros to speak (talk, panel or workshop)", event: true },
  { v: "Sponsorship", label: "Sponsorship or booth", event: true },
  { v: "Side event co-host", label: "Co-host a side event", event: true },
  { v: "Partnership", label: "Event or community partnership", event: false },
];

/**
 * Partnerships & event invitations, on the event manager's profile. Stored as a meeting request
 * (the team reads them on the Team desk). Spam guards: a hidden field bots fill in, a minimum
 * time on the page, required details, and the database limits from 0018.
 */
export default function PartnerForm({ to }: { to: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  const [kind, setKind] = useState(KINDS[0].v);
  const shown = useRef(Date.now());
  const done = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state === "sent") done.current?.focus(); }, [state]);
  const isEvent = KINDS.find((k) => k.v === kind)?.event ?? true;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    // a bot: filled the hidden field, or sent the form within seconds of the page opening
    if (s("website") || Date.now() - shown.current < 4000) { setState("sent"); return; }
    setState("sending");
    const message = [
      `For: ${to} (profile page)`,
      `${isEvent ? "Event" : "Partnership"}: ${s("what")}`,
      isEvent && s("when") ? `Date: ${s("when")}` : "",
      s("link") ? `Link: ${s("link")}` : "",
      "",
      s("proposal"),
    ].filter((x, i) => x || i === 4).join("\n");
    const { error } = await supabaseBrowser().from("meeting_requests").insert({
      event_id: null, name: s("name"), email: s("email"), company: s("org"), interest: kind, message,
    });
    if (error) { setErr(visitorError(error, "The request")); setState("error"); return; }
    setState("sent");
  }

  if (state === "sent") return <div className="ok" role="status" ref={done} tabIndex={-1}>Thanks. If it is a fit, {to} replies by email.</div>;
  return (
    <form onSubmit={submit} className="stack form-tight partner-form">
      <div className="field">
        <label htmlFor="pf-kind">What it is about</label>
        <select id="pf-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="pf-what">{isEvent ? "Event name" : "Partnership in one line"}</label><input id="pf-what" name="what" required maxLength={200} /></div>
      {isEvent && <div className="field"><label htmlFor="pf-when">Date and city</label><input id="pf-when" name="when" required maxLength={200} placeholder="e.g. 12 to 14 March 2027, Lisbon" /></div>}
      <div className="field"><label htmlFor="pf-link">Website or Luma page (optional)</label><input id="pf-link" name="link" type="url" maxLength={300} placeholder="https://" /></div>
      <div className="field"><label htmlFor="pf-proposal">What you are proposing</label><textarea id="pf-proposal" name="proposal" required minLength={40} maxLength={3000} placeholder="The audience, the format and what you would like Kleros to do." /></div>
      <div className="field"><label htmlFor="pf-org">Organisation</label><input id="pf-org" name="org" required maxLength={200} autoComplete="organization" /></div>
      <div className="field"><label htmlFor="pf-name">Your name</label><input id="pf-name" name="name" required maxLength={200} autoComplete="name" /></div>
      <div className="field"><label htmlFor="pf-email">Work email</label><input id="pf-email" name="email" type="email" required maxLength={200} autoComplete="email" /></div>
      {/* left empty by people; bots fill every field */}
      <div className="hp" aria-hidden="true"><label htmlFor="pf-website">Website</label><input id="pf-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      {state === "error" && <div className="note" role="alert">Not sent. {err}</div>}
      <button className="btn primary sm" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send request"}</button>
    </form>
  );
}
