"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError, NO_ACCESS } from "@/lib/friendlyError";
import type { TeamMember } from "@/lib/types";

export default function TeamPicker({ eventId, roster, initial }: { eventId: string; roster: TeamMember[]; initial: { team_member_id: string; part: string | null }[] }) {
  // what the screen shows, and what the database last confirmed (to put the screen back after a failed save)
  const [sel, setSel] = useState<Record<string, string>>(() => Object.fromEntries(initial.map((r) => [r.team_member_id, r.part ?? ""])));
  const saved = useRef<Record<string, string>>(Object.fromEntries(initial.map((r) => [r.team_member_id, r.part ?? ""])));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const without = (s: Record<string, string>, id: string) => { const n = { ...s }; delete n[id]; return n; };

  async function toggle(m: TeamMember) {
    setErr(""); setBusy(m.id);
    const sb = supabaseBrowser();
    const row = () => sb.from("event_team").select("team_member_id").eq("event_id", eventId).eq("team_member_id", m.id);
    if (m.id in sel) {
      setSel((s) => without(s, m.id));
      const { data, error } = await sb.from("event_team").delete().eq("event_id", eventId).eq("team_member_id", m.id).select("team_member_id");
      let problem = error ? friendlyError(error) : "";
      if (!problem && !data?.length) {
        // nothing deleted: it may be gone already, or this account cannot change the team (the database skips it without an error)
        const { data: still } = await row();
        if (still?.length) problem = NO_ACCESS;
      }
      if (problem) { setSel((s) => ({ ...s, [m.id]: saved.current[m.id] ?? "" })); setErr(problem); }
      else saved.current = without(saved.current, m.id);
    } else {
      setSel((s) => ({ ...s, [m.id]: "" }));
      const { error } = await sb.from("event_team").insert({ event_id: eventId, team_member_id: m.id, part: null });
      // already on the event (added in another tab, say): the screen is right as it is
      if (error && error.code !== "23505") { setSel((s) => without(s, m.id)); setErr(friendlyError(error)); }
      else saved.current = { ...saved.current, [m.id]: "" };
    }
    setBusy("");
  }
  async function savePart(id: string) {
    const part = (sel[id] ?? "").trim();
    if (!(id in saved.current) || part === saved.current[id]) return;
    setErr("");
    const { data, error } = await supabaseBrowser().from("event_team").update({ part: part || null }).eq("event_id", eventId).eq("team_member_id", id).select("team_member_id");
    if (error || !data?.length) {
      setSel((s) => (id in s ? { ...s, [id]: saved.current[id] ?? "" } : s));
      setErr(error ? friendlyError(error) : NO_ACCESS);
      return;
    }
    saved.current = { ...saved.current, [id]: part };
  }
  if (!roster.length) return <div className="empty"><b>No team members yet</b><Link href="/admin/team">Add people to list on event pages</Link> first.</div>;
  return (
    <div className="panel">
      {roster.map((m) => (
        <div key={m.id} className="row-flex">
          <button className={`btn sm ${m.id in sel ? "on" : ""}`} onClick={() => toggle(m)} disabled={busy === m.id} aria-pressed={m.id in sel}>{m.id in sel ? "✓ " : ""}{m.name}</button>
          {m.id in sel && <input className="search" style={{ maxWidth: 260 }} placeholder="Part: speaker, booth, judge…" value={sel[m.id]}
            onChange={(e) => { const v = e.target.value; setSel((s) => ({ ...s, [m.id]: v })); }} onBlur={() => savePart(m.id)} aria-label={`${m.name}'s part`} />}
          {!m.calendar_url && m.id in sel && <span className="muted small">No booking link</span>}
        </div>
      ))}
      {err && <div className="note" role="alert">{err}</div>}
    </div>
  );
}
