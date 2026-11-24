"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { removeFiles } from "@/lib/materials-client";
import { friendlyError } from "@/lib/friendlyError";
import { EVENT_TYPES, REGIONS, ROLE_LABEL, TOPICS } from "@/lib/kleros";
import { slugify } from "@/lib/format";
import type { EventRow, KlerosRole } from "@/lib/types";

/** Emails typed in a box: split on commas, spaces or new lines, lower-cased, deduplicated. */
export function parseEmails(text: string) {
  const all = text.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const ok = [...new Set(all.filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(x)))];
  return { ok, bad: all.filter((x) => !ok.includes(x)) };
}

/**
 * Create or edit an event. `me` describes the editor. Only the team creates events. Public events
 * are for the general public; private events are internal to the Kleros team (everyone on the
 * team, admins included, plus guests added by email; 0021). Switching an existing event between
 * public and private, and deleting a private event, is for its creator or an admin (the database
 * enforces it); the team deletes public ones.
 */
export default function EventForm({ event, me, initialVisibility, then, copyOf }: {
  event?: EventRow; me?: { isTeam: boolean; isAdmin?: boolean; userId: string };
  /** a new event: start with Private chosen (from "Add private event") */
  initialVisibility?: "public" | "private";
  /** a new event: "record" opens the recorder on the new event's page after saving */
  then?: "record";
  /** a new event: start from another event's details ("Make a private copy") */
  copyOf?: EventRow;
}) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [topics, setTopics] = useState<string[]>(event?.topics ?? []);
  const [visibility, setVisibility] = useState<"public" | "private">(event?.visibility ?? initialVisibility ?? "public");
  const [collabs, setCollabs] = useState("");
  const isTeam = me?.isTeam ?? true;
  const isCreator = !!event?.created_by && event.created_by === me?.userId;
  const isAdmin = !!me?.isAdmin;
  const canMakePublic = isTeam && (!event || event.visibility === "public" || isCreator || isAdmin);
  const canMakePrivate = !event || event.visibility === "private" || isCreator || isAdmin;
  const canDelete = event ? (event.visibility === "private" ? isCreator || isAdmin : isTeam) : false;

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault(); setErr("");
    const f = new FormData(ev.currentTarget);
    const s = (k: string) => (String(f.get(k) ?? "").trim() || null);
    const row = {
      title: s("title")!, kleros_role: s("kleros_role") as KlerosRole, organizer: s("organizer"), event_type: s("event_type")!,
      starts_on: s("starts_on")!, ends_on: s("ends_on"), start_time: s("start_time"), timezone: s("timezone"),
      city: s("city"), country: s("country"), region: s("region") ?? (s("city") ? null : "Online"), venue: s("venue"), url: s("url"), cover_path: s("cover_path"),
      description: s("description"), recap: s("recap"), topics, visibility,
      // a private event is never "published"; made public later, it starts as a draft
      status: (visibility === "private" ? "draft" : s("status") ?? "draft") as "draft" | "published",
      // an emptied slug box keeps the current address when editing (a private event's has a random ending)
      slug: s("slug") ?? event?.slug ?? slugify(`${s("title")}-${s("starts_on")?.slice(0, 7)}`), updated_at: new Date().toISOString(),
    };
    if (row.ends_on && row.ends_on < row.starts_on) { setErr("The end date is before the start date."); return; }
    const emails = parseEmails(collabs);
    if (!event && visibility === "private" && emails.bad.length) { setErr(`Not an email address: ${emails.bad.join(", ")}`); return; }
    setBusy(true);
    const sb = supabaseBrowser();
    const save = (r: typeof row & { is_free?: boolean | null }) => event ? sb.from("events").update(r).eq("id", event.id).select("id, slug").single() : sb.from("events").insert(r).select("id, slug").single();
    let res = await save({ ...row, is_free: f.get("is_free") ? true : null });
    // before 0017 there is no is_free column: save without it
    if (res.error && /is_free/.test(res.error.message ?? "")) res = await save(row);
    if (res.error) { setBusy(false); setErr(saveError(res.error, visibility)); return; }
    // made public: the collaborator list goes (the database does this too from 0012)
    if (event?.visibility === "private" && visibility === "public") await sb.from("event_collaborators").delete().eq("event_id", event.id);
    if (!event && visibility === "private" && emails.ok.length) {
      const { error } = await sb.from("event_collaborators").insert(emails.ok.map((email) => ({ event_id: res.data.id, email })));
      if (error) { setBusy(false); setErr(`The event was created, but the guests were not added. ${friendlyError(error)}`); router.push(`/admin/events/${res.data.id}#collaborators`); return; }
    }
    setBusy(false);
    if (!event) router.push(then === "record" ? `/events/${res.data.slug}#record` : `/admin/events/${res.data.id}`);
    // say it worked: the page shows "Saved" from ?saved=1
    else { router.replace(`/admin/events/${event.id}?saved=1`); router.refresh(); }
  }
  async function remove() {
    if (!event) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    const sb = supabaseBrowser();
    // a private event's uploaded files go with it, except files of items also on another event
    // (the database deletes the items that belong to this event alone). Files first: once the event
    // is gone, what is left in its folder can only be deleted from the Supabase dashboard, so the
    // event stays until its files are gone.
    if (event.visibility === "private") {
      const { data: files, error: fErr } = await sb.rpc("private_event_files", { p_event: event.id });
      if (fErr) { setErr(friendlyError(fErr)); return; }
      if (!(await removeFiles((files ?? []) as string[]))) {
        setErr("Some of the event's files could not be deleted from storage, so the event is still here. Try again in a minute.");
        setConfirmDel(false); return;
      }
    }
    const { data, error } = await sb.from("events").delete().eq("id", event.id).select("id");
    if (error) { setErr(friendlyError(error)); return; }
    if (!data?.length) { setErr("Only the person who created this private event, or an admin, can delete it."); setConfirmDel(false); return; }
    router.push("/admin");
  }

  // a private copy keeps the details but gets its own address
  const v = event ?? (copyOf ? { ...copyOf, slug: "" } : undefined);
  // why a choice is locked, said once and visibly, with a way forward
  const lockedPrivate = !canMakePrivate && visibility !== "private";
  const lockedPublic = !canMakePublic && visibility !== "public";
  const privateReason = !event?.created_by
    ? "This event was imported from Luma or added before private events existed, so only an admin can make it private."
    : "A teammate created this event, so only they or an admin can make it private.";
  return (
    <form className="panel" onSubmit={submit}>
      <div className="field"><label htmlFor="title">Event name</label><input id="title" name="title" required defaultValue={v?.title} placeholder={visibility === "private" ? "General assembly, November 2026" : "Kleros Court Day Lisbon"} /></div>
      <fieldset className="field vis-choice">
        <legend className="lbl">Who can see it</legend>
        <label className="vis-opt" data-on={visibility === "public"} aria-disabled={lockedPublic}>
          <input type="radio" name="visibility" value="public" checked={visibility === "public"} disabled={lockedPublic} onChange={() => setVisibility("public")} />
          <span><b>Public</b><span className="muted small">For the general public. Listed on the site once published, and the whole Kleros team can edit it.</span></span>
        </label>
        <label className="vis-opt" data-on={visibility === "private"} aria-disabled={lockedPrivate}>
          <input type="radio" name="visibility" value="private" checked={visibility === "private"} disabled={lockedPrivate} onChange={() => setVisibility("private")} />
          <span><b>Private</b><span className="muted small">Internal to Kleros. Everyone on the Kleros team (signed in with a Kleros email, admins included) can see and edit it, its recordings and its questions. It never shows on the public site.</span></span>
        </label>
      </fieldset>
      {lockedPrivate && event && (
        <div className="note vis-why">
          {privateReason} To record something for the team only, make a private copy: it keeps these details, and this public event stays as it is.
          <div className="row-flex"><a className="btn sm" href={`/admin/events/new?visibility=private&from=${event.id}`}>Make a private copy</a></div>
        </div>
      )}
      {lockedPublic && (
        <div className="note vis-why">{isCreator || isAdmin ? "Making an event public needs a Kleros team account." : "Only the person who created this private event, or an admin, can make it public."}</div>
      )}
      {visibility === "private" && !event && (
        <div className="field"><label htmlFor="collabs">Guests from outside Kleros (optional)</label>
          <textarea id="collabs" value={collabs} onChange={(e) => setCollabs(e.target.value)} placeholder={"partner@example.org, speaker@example.com"} style={{ minHeight: 60 }} />
          <span className="muted small">The Kleros team already has access. Add anyone else who should see and edit this event, such as a partner or a speaker: email addresses, separated by commas or new lines. They see it once they sign in with that email. Nobody is emailed automatically. More can be added later.</span>
        </div>
      )}
      {visibility === "private" && event?.visibility === "public" && (
        <p className="note" style={{ margin: 0 }}>Saving makes this event private: it leaves the public site and becomes internal to the Kleros team, with its talks, files and questions. {!event.created_by && "You become its creator."}</p>
      )}
      {visibility === "public" && event?.visibility === "private" && (
        <p className="note" style={{ margin: 0 }}>Saving makes this event public, for the general public. It stays off the public site until its status is set to Published. Guests added from outside Kleros lose access.</p>
      )}
      <div className="two">
        <div className="field"><label htmlFor="kleros_role">Kleros&apos; role</label><select id="kleros_role" name="kleros_role" defaultValue={v?.kleros_role ?? "host"}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="field"><label htmlFor="organizer">Organizer</label><input id="organizer" name="organizer" defaultValue={v?.organizer ?? ""} placeholder="Kleros, ETHGlobal, a university…" /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor="event_type">Type</label><select id="event_type" name="event_type" defaultValue={v?.event_type ?? "Conference"}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        {visibility === "public"
          ? <div className="field"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={v?.status ?? "draft"}><option value="draft">Draft (team only)</option><option value="published">Published</option></select></div>
          : <div className="field"><span className="lbl">Status</span><p className="muted small" style={{ margin: "6px 0 0" }}>Private events are never listed on the public site.</p></div>}
      </div>
      <div className="two">
        <div className="field"><label htmlFor="starts_on">Starts</label><input id="starts_on" name="starts_on" type="date" required defaultValue={v?.starts_on} /></div>
        <div className="field"><label htmlFor="ends_on">Ends</label><input id="ends_on" name="ends_on" type="date" defaultValue={v?.ends_on ?? ""} /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor="start_time">Start time</label><input id="start_time" name="start_time" type="time" defaultValue={v?.start_time?.slice(0, 5) ?? ""} /></div>
        <div className="field"><label htmlFor="timezone">Time zone</label><input id="timezone" name="timezone" defaultValue={v?.timezone ?? ""} placeholder="GMT+7" /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor="city">City</label><input id="city" name="city" defaultValue={v?.city ?? ""} placeholder="Leave empty if online" /></div>
        <div className="field"><label htmlFor="country">Country</label><input id="country" name="country" defaultValue={v?.country ?? ""} /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor="region">Region</label><select id="region" name="region" defaultValue={v?.region ?? ""}><option value="">–</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div className="field"><label htmlFor="venue">Venue or stream</label><input id="venue" name="venue" defaultValue={v?.venue ?? ""} /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor="url">Event page (Luma, Eventbrite…)</label><input id="url" name="url" type="url" defaultValue={v?.url ?? ""} placeholder="https://" /></div>
        <label className="small"><input type="checkbox" name="is_free" defaultChecked={!!v?.is_free} /> Free to attend (the button says &quot;Get tickets (free)&quot;)</label>
        <div className="field"><label htmlFor="cover_path">Cover image URL</label><input id="cover_path" name="cover_path" type="url" defaultValue={v?.cover_path ?? ""} placeholder="https://" aria-describedby="cover_path_hint" />
          <span id="cover_path_hint" className="small muted">The event&apos;s own poster or banner, from its website or Luma. Leave it empty and the site makes a Kleros cover. Pictures from X, YouTube or LinkedIn posts are not used.</span></div>
      </div>
      <div className="field"><span className="lbl">Topics (drive recommendations and the product promos shown)</span>
        <div className="chips" style={{ margin: 0 }}>{TOPICS.map((t) => <button type="button" key={t} className="chip" aria-pressed={topics.includes(t)} onClick={() => setTopics(topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t])}>{t}</button>)}</div></div>
      <div className="field"><label htmlFor="description">Description</label><textarea id="description" name="description" defaultValue={v?.description ?? ""} /></div>
      <div className="field"><label htmlFor="recap">Recap (after the event)</label><textarea id="recap" name="recap" defaultValue={v?.recap ?? ""} placeholder="What happened, who attended, key takeaways" /></div>
      <div className="field"><label htmlFor="slug">Web address (the end of the link)</label><input id="slug" name="slug" defaultValue={v?.slug ?? ""} placeholder={event ? "Keeps the current address if empty" : "Made from the name if empty"} /></div>
      {err && <div className="note">{err}</div>}
      <div className="row-flex">
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : event ? "Save changes" : then === "record" ? "Create and start recording" : visibility === "private" ? "Create private event" : "Create event"}</button>
        {event && canDelete && <button className={`btn ghost${confirmDel ? " danger-armed" : ""}`} type="button" onClick={remove}>{confirmDel ? (event.visibility === "private" ? "Delete the event and its files for good?" : "Delete for good?") : "Delete event"}</button>}
      </div>
    </form>
  );
}

/** Plain-language reasons for the database refusals a save can hit; anything else goes through friendlyError. */
function saveError(error: { message: string }, visibility: "public" | "private") {
  const msg = error.message;
  if (msg.includes("events_slug_key")) return "Another event already uses this web address. Change the name or the web address.";
  if (/Only the person who created this event|needs a Kleros team account/.test(msg)) return msg;
  if (/row-level security/i.test(msg)) {
    return visibility === "private"
      ? "This account cannot save this private event. Private events are for the Kleros team and the guests added to them."
      : "Only Kleros team members can create or edit public events.";
  }
  if (/0 rows|no rows|multiple \(or no\) rows/i.test(msg)) return "This account cannot edit this event.";
  return friendlyError(error);
}
