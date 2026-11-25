"use client";
import { useState } from "react";
import Link from "next/link";
import { ensureUser, supabaseBrowser } from "@/lib/supabase/client";
import { authorOf, byNew, byTop, useQuestions } from "@/lib/useQuestions";
import { qaError } from "@/lib/qaErrors";
import type { Question } from "@/lib/types";

// Anyone can ask and upvote without an account (a quiet anonymous session), with an optional name.
export default function AskTheSpeaker({ eventId, isTeam, slug, past = false, isPrivate = false }: { eventId: string; isTeam: boolean; slug: string; past?: boolean; isPrivate?: boolean }) {
  // the same live list as the phone page: realtime filtered to this event, reloads gathered and spread out
  const { questions, myVotes, uid, reload } = useQuestions(eventId, { poll: false });
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [sort, setSort] = useState<"top" | "new">("top");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(""); setSent(false); setBusy(true);
    try { await send(); } finally { setBusy(false); }
  }
  async function send() {
    const sb = supabaseBrowser();
    let me: string;
    try { me = (await ensureUser()).id; } catch (x) { setErr(qaError(x)); return; }
    const named = guestName.trim().slice(0, 60);
    // no automatic upvote of one's own question: the list counts other people's votes
    const { error } = await sb.from("questions").insert({ event_id: eventId, body: body.trim(), anonymous: !named, author_id: me, author_name: named || null });
    if (error) {
      setErr(qaError(error));
      return;
    }
    setBody(""); reload();
    // say it went, as the phone page does; the box emptying alone looks like nothing happened
    setSent(true);
    window.setTimeout(() => setSent(false), 5000);
  }
  async function vote(q: Question) {
    let me = uid;
    if (!me) { try { me = (await ensureUser()).id; } catch (x) { setErr(qaError(x)); return; } }
    const sb = supabaseBrowser();
    const { error } = myVotes.has(q.id)
      ? await sb.from("question_votes").delete().eq("question_id", q.id).eq("user_id", me)
      : await sb.from("question_votes").insert({ question_id: q.id, user_id: me });
    setErr(error ? qaError(error) : "");
    reload();
  }
  const list = questions.filter((q) => q.status !== "hidden").sort(sort === "new" ? byNew : byTop);

  return (
    <div className="stack">
      <form className="row-flex" onSubmit={ask}>
        <input className="search" value={body} onChange={(e) => setBody(e.target.value)} placeholder={past ? "Leave a question for the speakers" : "Ask the Kleros speakers a question"} maxLength={280} minLength={3} required aria-label="Your question" enterKeyHint="send" />
        <input className="search" style={{ flex: "0 1 160px" }} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Your name (optional)" maxLength={40} aria-label="Your name" />
        <button className="btn primary sm" type="submit" disabled={busy}>{busy ? "Sending…" : "Send question"}</button>
      </form>
      {err && <div className="note" role="alert">{err}</div>}
      {sent && !err && <div className="ok" role="status">Sent. It is in the list below.</div>}
      <div className="row-flex">
        <div className="seg" role="group" aria-label="Sort"><button aria-pressed={sort === "top"} onClick={() => setSort("top")}>Top</button><button aria-pressed={sort === "new"} onClick={() => setSort("new")}>New</button></div>
        {/* the phone page is for the room during the talk */}
        {!past && <Link className="btn sm ghost" href={`/q/${slug}`}>Ask from your phone</Link>}
        {isTeam && <Link className="btn sm" href={`/events/${slug}/host`} style={{ marginLeft: "auto" }}>Moderate questions</Link>}
      </div>
      {list.map((q) => {
        const on = myVotes.has(q.id);
        const count = `${q.votes} ${q.votes === 1 ? "vote" : "votes"}`;
        return (
          <div key={q.id} className={`q ${q.featured ? "feat" : ""} ${q.status === "answered" ? "done" : ""}`}>
            <button className={`vote ${on ? "on" : ""}`} onClick={() => vote(q)} aria-pressed={on} aria-label={on ? `Remove upvote, ${count}` : `Upvote, ${count}`}><span aria-hidden>▲</span><span>{q.votes}</span></button>
            <div style={{ minWidth: 0 }}>
              <div style={{ overflowWrap: "anywhere" }}>{q.body}</div>
              <div className="by">{authorOf(q)}{q.featured ? " · on screen" : ""}{q.status === "answered" ? " · answered" : ""}</div>
            </div>
          </div>
        );
      })}
      {!list.length && <p className="quiet-empty">{isPrivate
        ? "No questions yet. This event is internal: only the Kleros team and the guests added to it see the questions left here."
        : past
          ? "No questions yet. The Kleros team reads every question left here. Answers are not posted on this page, so to hear back by email, use Request a meeting under Meet Kleros."
          : "No questions yet. Questions work during the talk and after it, and the speakers see them all."}</p>}
    </div>
  );
}
