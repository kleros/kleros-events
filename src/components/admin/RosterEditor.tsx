"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError, NO_ACCESS } from "@/lib/friendlyError";
import type { TeamMember } from "@/lib/types";

export default function RosterEditor({ initial }: { initial: TeamMember[] }) {
  const [list, setList] = useState(initial);
  const [err, setErr] = useState("");
  const [addErr, setAddErr] = useState("");
  const [confirm, setConfirm] = useState("");
  // bumped after a failed change so the row's fields show the saved values again
  const [ver, setVer] = useState(0);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setAddErr("");
    const form = e.currentTarget; // React clears currentTarget once the await below starts
    const f = new FormData(form);
    const g = (k: string) => String(f.get(k) ?? "").trim() || null;
    const { data, error } = await supabaseBrowser().from("team_members").insert({ name: g("name"), title: g("title"), x_handle: g("x"), calendar_url: g("cal"), avatar_url: g("avatar"), sort: list.length }).select("*").single();
    if (error) { setAddErr(friendlyError(error)); return; }
    setList((l) => [...l, data as TeamMember]); form.reset();
  }
  async function patch(m: TeamMember, p: Partial<TeamMember>) {
    if (Object.entries(p).every(([k, v]) => m[k as keyof TeamMember] === v)) return;
    setErr("");
    const { data, error } = await supabaseBrowser().from("team_members").update(p).eq("id", m.id).select("id");
    // no row back means the database skipped the change (signed out, or not a team account)
    if (error || !data?.length) { setErr(error ? friendlyError(error) : NO_ACCESS); setVer((v) => v + 1); return; }
    setList((l) => l.map((x) => (x.id === m.id ? { ...x, ...p } : x)));
  }
  /** Asks once ("Remove?") so a stray click does not take someone off the roster. */
  async function remove(m: TeamMember) {
    if (confirm !== m.id) {
      setConfirm(m.id);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirm((c) => (c === m.id ? "" : c)), 4000);
      return;
    }
    setConfirm(""); setErr("");
    const { data, error } = await supabaseBrowser().from("team_members").update({ active: false }).eq("id", m.id).select("id");
    if (error || !data?.length) { setErr(error ? friendlyError(error) : NO_ACCESS); return; }
    setList((l) => l.filter((x) => x.id !== m.id));
  }
  return (
    <div className="stack">
      {list.length === 0 && <div className="empty"><b>Nobody on the roster yet</b>Add the first person below.</div>}
      {err && <div className="note" role="alert">{err}</div>}
      <div className="table-wrap" hidden={list.length === 0}><table className="table">
        <thead><tr><th>Name</th><th>Title</th><th>X handle</th><th>Booking link</th><th></th></tr></thead>
        <tbody>{list.map((m) => (
          <tr key={`${m.id}-${ver}`}>
            <td><b>{m.name}</b></td>
            <td><input className="search" defaultValue={m.title ?? ""} onBlur={(e) => patch(m, { title: e.target.value.trim() || null })} aria-label="Title" /></td>
            <td><input className="search" defaultValue={m.x_handle ?? ""} onBlur={(e) => patch(m, { x_handle: e.target.value.trim() || null })} aria-label="X handle" /></td>
            <td><input className="search" defaultValue={m.calendar_url ?? ""} onBlur={(e) => patch(m, { calendar_url: e.target.value.trim() || null })} aria-label="Booking link" placeholder="https://cal.com/…" /></td>
            <td><button className="btn sm ghost" onClick={() => remove(m)} aria-label={confirm === m.id ? `Confirm removing ${m.name}` : `Remove ${m.name}`}>{confirm === m.id ? "Remove?" : "Remove"}</button></td>
          </tr>))}</tbody>
      </table></div>
      <form className="panel" onSubmit={add}>
        <h3>Add a person</h3>
        <div className="two"><div className="field"><label htmlFor="n">Name</label><input id="n" name="name" required placeholder="Full name" /></div><div className="field"><label htmlFor="ti">Title</label><input id="ti" name="title" placeholder="Head of BD" /></div></div>
        <div className="two"><div className="field"><label htmlFor="x">X handle</label><input id="x" name="x" placeholder="@handle" /></div><div className="field"><label htmlFor="cal">Booking link</label><input id="cal" name="cal" type="url" placeholder="https://cal.com/…" /></div></div>
        <div className="field"><label htmlFor="av">Photo URL</label><input id="av" name="avatar" type="url" /></div>
        {addErr && <div className="note" role="alert">{addErr}</div>}
        <button className="btn primary" type="submit">Add to roster</button>
      </form>
    </div>
  );
}
