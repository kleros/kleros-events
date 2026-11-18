"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BUSY, NOT_SET_UP, NOT_SET_UP_DEV, NO_SUMMARY, NO_SUMMARY_DEV, isUntimed, type Segment, type Summary, type TranscriptRow, type TranscriptState } from "@/lib/transcript/types";
import { WHO, clock, indexAt, paragraphs, parseTranscriptFile, toSrt, toTxt } from "@/lib/transcript/parse";
import { summaryText } from "@/lib/transcript/summary";
import { fetchTranscript, runTranscript, saveText, seekTo, useMediaTime } from "@/lib/transcript/client";
import { slugify } from "@/lib/format";

export interface TranscriptSetup { transcribe: boolean; summary: boolean }

const STATUS_LABEL: Record<string, string> = {
  queued: "Waiting to start…",
  transcribing: "Transcribing…",
  summarising: "Writing summary…",
};

/**
 * The talk page around its player: summary on top, the player (children), then the full
 * transcript. Team members also get the tools to generate, regenerate or upload.
 */
export default function TranscriptArea({ materialId, title, speaker, initial, isTeam, canSeek, canTranscribe, setup, durationHint, children }: {
  materialId: string; title: string; speaker?: string | null; initial: TranscriptRow | null; isTeam: boolean;
  /** the player on the page can be seeked (not true for Google Drive embeds) */
  canSeek: boolean;
  /** there is a recording stored on the site that the server can transcribe */
  canTranscribe: boolean;
  setup: TranscriptSetup; durationHint?: number | null;
  children: React.ReactNode;
}) {
  const [row, setRow] = useState<TranscriptRow | null>(initial);
  const [state, setState] = useState<TranscriptState>({ status: initial?.status ?? "none", error: initial?.error });
  const [msg, setMsg] = useState("");
  const running = useRef(false);

  const reload = useCallback(async () => { const r = await fetchTranscript(materialId); if (r) { setRow(r); setState({ status: r.status, error: r.error }); } }, [materialId]);

  // someone else's run in progress (the host console, another tab): follow it
  useEffect(() => {
    if (!BUSY.includes(state.status) || running.current) return;
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [state.status, reload]);

  async function run(step: "auto" | "transcript" | "summary" | "import", body?: unknown) {
    if (running.current) return;
    running.current = true; setMsg("");
    const s = await runTranscript(materialId, setState, { step, body });
    running.current = false;
    setState(s);
    if (s.status === "done" && s.error) setMsg(s.error);
    await reload();
    if (s.status === "error") setState(s); // keep the route's message even if the row could not be read
  }

  async function upload(f: File | undefined) {
    if (!f) return;
    if (f.size > 5e6) { setMsg("That file is over 5 MB. Transcript files are usually much smaller; check it is an .srt, .vtt or .txt file."); return; }
    const src = await f.text();
    const parsed = parseTranscriptFile(f.name, src, durationHint ?? undefined);
    if (!parsed.segments.length) { setMsg("No text was found in that file."); return; }
    await run("import", parsed);
  }

  const segs = row?.segments ?? [];
  const timed = !isUntimed(row?.provider);
  const seekable = canSeek && timed;
  const busy = BUSY.includes(state.status);

  const team = isTeam && (
    <TeamTools state={state} row={row} setup={setup} canTranscribe={canTranscribe} busy={busy} msg={msg}
      onGenerate={() => run(segs.length ? "transcript" : "auto")} onSummary={() => run("summary")} onUpload={upload} />
  );

  return (
    <>
      {row?.summary && <SummaryCard s={row.summary} title={title} timed={timed} seekable={seekable} />}
      {!row?.summary && busy && <div className="tx-pending" role="status"><span className="tx-spin" aria-hidden />{STATUS_LABEL[state.status]} The summary and transcript appear here when ready.</div>}
      {children}
      {team}
      {segs.length > 0 && <TranscriptBody segs={segs} title={title} speaker={speaker} timed={timed} seekable={seekable} language={row?.language} />}
    </>
  );
}

// ---------------------------------------------------------------- summary

function Stamp({ t, seekable, timed }: { t: number; seekable: boolean; timed: boolean }) {
  const label = timed ? clock(t) : `~${clock(t)}`;
  if (!seekable) return <span className="tx-t mono">{label}</span>;
  return <button type="button" className="tx-t mono" onClick={() => jump(t)} aria-label={`Play from ${clock(t)}`}>{label}</button>;
}

// a chapter, timestamp or line asked for a moment: the folded transcript opens if it is further down
const JUMP = "kleros:tx-jump";
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Seek the player and bring it into view if it is off screen. */
function jump(t: number) {
  seekTo(t);
  window.dispatchEvent(new CustomEvent<number>(JUMP, { detail: t }));
  const p = document.querySelector("[data-player]");
  if (!p) return;
  const r = p.getBoundingClientRect();
  if (r.bottom < 60 || r.top > window.innerHeight - 60) p.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
}

function SummaryCard({ s, title, timed, seekable }: { s: Summary; title: string; timed: boolean; seekable: boolean }) {
  const [copied, setCopied] = useState(false);
  const extra = s.quotes.length > 0 || (s.audience_questions?.length ?? 0) > 0;
  async function copy() {
    try { await navigator.clipboard.writeText(summaryText(s, title, timed)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  }
  return (
    <section className="tx-summary" aria-labelledby="tx-sum-h">
      <div className="tx-head">
        <h2 id="tx-sum-h" className="eyebrow">Summary</h2>
        <button type="button" className="btn sm ghost" onClick={copy}>{copied ? "Copied" : "Copy summary"}</button>
      </div>
      <div className="tx-sum-grid">
        <div className="tx-sum-main">
          <p className="tx-tldr">{s.tldr}</p>
          {s.key_points.length > 0 && (
            <>
              <h3 className="tx-sub">Key points</h3>
              <ul className="tx-points">{s.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
            </>
          )}
        </div>
        {s.chapters.length > 0 && (
          <nav className="tx-chapters" aria-label="Chapters">
            <h3 className="tx-sub">Chapters</h3>
            <ol>
              {s.chapters.map((c, i) => (
                <li key={i}>
                  {seekable
                    ? <button type="button" onClick={() => jump(c.t)}><span className="tx-t mono">{clock(c.t)}</span><span>{c.title}</span></button>
                    : <div><span className="tx-t mono">{timed ? clock(c.t) : `~${clock(c.t)}`}</span><span>{c.title}</span></div>}
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
      {s.action_items?.length ? (
        <div className="tx-todo">
          <h3 className="tx-sub">Action items</h3>
          <ol>
            {s.action_items.map((a, i) => (
              <li key={i} className="tx-todo-row">
                <Stamp t={a.t} seekable={seekable} timed={timed} />
                <div>
                  {a.owner && <b>{a.owner}</b>}
                  <span>{a.task}</span>
                  {a.due && <span className="muted small"> · {a.due}</span>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {extra && (
        <details className="tx-more">
          <summary>Quotes{s.audience_questions?.length ? " and audience questions" : ""}</summary>
          <div className="tx-more-body">
            {s.quotes.map((q, i) => (
              <figure key={i} className="tx-quote">
                <blockquote>{q.text}</blockquote>
                <figcaption><Stamp t={q.t} seekable={seekable} timed={timed} />{q.speaker ? <span>{q.speaker}</span> : null}</figcaption>
              </figure>
            ))}
            {s.audience_questions?.length ? (
              <div className="tx-qa">
                <h3 className="tx-sub">Audience questions</h3>
                {s.audience_questions.map((q, i) => (
                  <div key={i} className="tx-qa-row">
                    <Stamp t={q.t} seekable={seekable} timed={timed} />
                    <div><b>{q.question}</b>{q.answer && <p className="muted">{q.answer}</p>}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      )}
      <p className="tx-fine">Written automatically from the transcript. It can contain mistakes, especially in names.</p>
    </section>
  );
}

// ---------------------------------------------------------------- transcript

const FOLLOW_KEY = "kleros-tx-follow";
/** On a phone a long transcript shows this many paragraphs, then a button for the rest. */
const FOLD = 12;

/** The box keeps no scroll of its own (a phone, or a short transcript): the page scrolls instead. */
const boxStill = (b: HTMLElement) => b.scrollHeight <= b.clientHeight + 1;

/**
 * The reader has scrolled past the player above the transcript (or there is none above it), and
 * is still in the transcript. Only then may following move the page.
 */
function pastPlayer(b: HTMLElement) {
  const above = Array.from(document.querySelectorAll<HTMLElement>("[data-player]"))
    .filter((p) => p.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const p = above[above.length - 1];
  return (!p || p.getBoundingClientRect().bottom < 80) && b.getBoundingClientRect().bottom > 80;
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

/** A paragraph, with its speaker prefix ("Wei Wei: ") in bold. */
function Para({ text, q }: { text: string; q: string }) {
  const m = WHO.exec(text);
  if (!m) return <Highlight text={text} q={q} />;
  return <><b className="tx-who"><Highlight text={m[1]} q={q} />:</b> <Highlight text={text.slice(m[0].length)} q={q} /></>;
}

function TranscriptBody({ segs, title, speaker, timed, seekable, language }: { segs: Segment[]; title: string; speaker?: string | null; timed: boolean; seekable: boolean; language?: string | null }) {
  const paras = useMemo(() => paragraphs(segs), [segs]);
  const { t, playing } = useMediaTime();
  // nothing is "current" before the recording has been started
  const cur = seekable && (playing || t > 0) ? indexAt(paras, t) : -1;
  const [q, setQ] = useState("");
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(0);
  // until when page scroll events come from following itself, not from the reader
  const selfScroll = useRef(0);
  const [unfolded, setUnfolded] = useState(false);

  useEffect(() => { try { if (localStorage.getItem(FOLLOW_KEY) === "0") setFollow(false); } catch { /* storage blocked */ } }, []);
  const toggleFollow = () => { const v = !follow; setFollow(v); try { localStorage.setItem(FOLLOW_KEY, v ? "1" : "0"); } catch { /* storage blocked */ } };

  // where the box has no scroll of its own, the reader scrolling the page counts like scrolling the box
  useEffect(() => {
    const on = () => {
      const b = box.current;
      if (!b || !boxStill(b) || Date.now() < selfScroll.current) return;
      userScrolled.current = Date.now();
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // keep the playing paragraph in view, unless the reader scrolled in the last 6 s: inside the
  // transcript box, or on a phone (no box) by scrolling the page once the reader is past the player
  useEffect(() => {
    if (!follow || !playing || cur < 0 || q || Date.now() - userScrolled.current < 6000) return;
    const b = box.current; const el = b?.querySelector<HTMLElement>(`[data-i="${cur}"]`);
    if (!b || !el) return;
    const behavior: ScrollBehavior = reduced() ? "auto" : "smooth";
    if (boxStill(b)) {
      if (!el.getClientRects().length || !pastPlayer(b)) return;
      const r = el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > innerHeight - 80) {
        selfScroll.current = Date.now() + (behavior === "smooth" ? 1200 : 200);
        el.scrollIntoView({ block: "center", behavior });
      }
      return;
    }
    const top = el.offsetTop - b.offsetTop, bottom = top + el.offsetHeight;
    if (top < b.scrollTop + 24 || bottom > b.scrollTop + b.clientHeight - 24) b.scrollTo({ top: Math.max(0, top - b.clientHeight / 3), behavior });
  }, [cur, follow, playing, q]);

  // the folded transcript opens for good once the recording reaches a later paragraph, or a
  // chapter or timestamp asks for one
  useEffect(() => { if (cur >= FOLD) setUnfolded(true); }, [cur]);
  useEffect(() => {
    const on = (e: Event) => { if (indexAt(paras, (e as CustomEvent<number>).detail) >= FOLD) setUnfolded(true); };
    window.addEventListener(JUMP, on);
    return () => window.removeEventListener(JUMP, on);
  }, [paras]);

  const needle = q.trim().toLowerCase();
  const shown = needle ? paras.map((p, i) => ({ p, i })).filter(({ p }) => p.text.toLowerCase().includes(needle)) : paras.map((p, i) => ({ p, i }));
  const hits = needle ? paras.reduce((n, p) => n + (p.text.toLowerCase().split(needle).length - 1), 0) : 0;
  const words = useMemo(() => segs.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0), [segs]);
  const base = slugify(title) || "transcript";
  const header = [title, speaker].filter(Boolean).join(" · ");
  // folded only on a phone (the CSS hides .tx-later there); a search shows every match
  const folded = !needle && !unfolded && cur < FOLD && paras.length > FOLD + 3;
  const unfold = () => {
    setUnfolded(true);
    // the button goes away: keyboard focus moves to the first paragraph it showed
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-i="${FOLD}"]`)?.focus({ preventScroll: true }));
  };

  return (
    <section className="tx-body" aria-labelledby="tx-h">
      <div className="tx-head">
        <div>
          <h2 id="tx-h" className="eyebrow">Transcript</h2>
          <div className="tx-meta muted small">{words.toLocaleString("en-GB")} words{language ? ` · ${language.length <= 3 ? language.toUpperCase() : language[0].toUpperCase() + language.slice(1)}` : ""}{timed ? "" : " · times are estimates"}</div>
        </div>
        <div className="tx-actions">
          {seekable && <button type="button" className={`btn sm ${follow ? "on" : ""}`} aria-pressed={follow} onClick={toggleFollow} title="Scroll the transcript along with the recording">Follow along</button>}
          <button type="button" className="btn sm" onClick={() => saveText(`${base}.txt`, toTxt(segs, header, timed))}>.txt</button>
          {timed && <button type="button" className="btn sm" onClick={() => saveText(`${base}.srt`, toSrt(segs), "application/x-subrip")}>.srt</button>}
        </div>
      </div>
      <div className="tx-search">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the transcript" aria-label="Search the transcript" />
        {needle && <span className="muted small mono" aria-live="polite">{hits} {hits === 1 ? "match" : "matches"}</span>}
      </div>
      <div className="tx-lines" ref={box} onWheel={() => (userScrolled.current = Date.now())} onTouchMove={() => (userScrolled.current = Date.now())}>
        {shown.length === 0 && <p className="muted tx-none">No matches for “{q.trim()}”.</p>}
        {shown.map(({ p, i }) => (
          <div key={i} data-i={i} className={`tx-line ${i === cur ? "cur" : ""}${folded && i >= FOLD ? " tx-later" : ""}`} tabIndex={i === FOLD ? -1 : undefined}>
            {seekable
              ? <button type="button" className="tx-t mono" onClick={() => jump(p.start)} aria-label={`Play from ${clock(p.start)}`}>{clock(p.start)}</button>
              : <span className="tx-t mono">{timed ? clock(p.start) : ""}</span>}
            <p onClick={seekable ? () => jump(p.start) : undefined} className={seekable ? "seek" : ""}><Para text={p.text} q={q.trim()} /></p>
          </div>
        ))}
      </div>
      {folded && <button type="button" className="btn tx-unfold" onClick={unfold}>Show the full transcript ({words.toLocaleString("en-GB")} words)</button>}
    </section>
  );
}

// ---------------------------------------------------------------- team tools

/** A note in the team's tools: the plain line, with any technical text folded away for a developer. */
function TeamNote({ text, dev, alert }: { text: string; dev?: string; alert?: boolean }) {
  if (!dev) return <p className="tx-note" role={alert ? "alert" : undefined}>{text}</p>;
  return (
    <div className="tx-note" role={alert ? "alert" : undefined}>
      <p>{text}</p>
      <details className="small muted">
        <summary>Details for a developer</summary>
        <p>{dev}</p>
      </details>
    </div>
  );
}

/** A message from the server that names a setting or a database step gets a plain line for the team. */
function forTeam(m: string): { text: string; dev?: string } {
  if (!/\b[A-Z][A-Z0-9]*_[A-Z0-9_]*KEY\b|\.sql\b/.test(m)) return { text: m };
  if (/^Transcript saved/.test(m)) return { text: `Transcript saved. ${NO_SUMMARY}`, dev: m };
  return { text: "This did not work because of a site setting. A developer can fix it.", dev: m };
}

function TeamTools({ state, row, setup, canTranscribe, busy, msg, onGenerate, onSummary, onUpload }: {
  state: TranscriptState; row: TranscriptRow | null; setup: TranscriptSetup; canTranscribe: boolean; busy: boolean; msg: string;
  onGenerate: () => void; onSummary: () => void; onUpload: (f: File | undefined) => void;
}) {
  const has = !!row?.segments?.length;
  const notSetUp = state.setup || (!setup.transcribe && !setup.summary);
  const status = busy ? STATUS_LABEL[state.status]
    : state.status === "error" ? "Last run failed"
    : has && row?.summary ? "Transcript and summary ready"
    : has ? "Transcript ready, no summary yet"
    : "No transcript yet";
  return (
    <section className="tx-team" aria-label="Transcript tools (team only)">
      <div className="tx-team-row">
        <span className={`tx-status s-${busy ? "busy" : state.status}`}>{busy && <span className="tx-spin" aria-hidden />}{status}</span>
        <span className="spacer" />
        {canTranscribe && setup.transcribe && (
          <button type="button" className={`btn sm ${has ? "" : "primary"}`} onClick={onGenerate} disabled={busy}>{has ? "Transcribe again" : "Generate transcript"}</button>
        )}
        {has && setup.summary && <button type="button" className="btn sm" onClick={onSummary} disabled={busy}>{row?.summary ? "Regenerate summary" : "Write summary"}</button>}
        <label className={`btn sm ghost ${busy ? "is-busy" : ""}`} title="An .srt, .vtt or .txt transcript, for example from YouTube or a meeting tool">
          Upload transcript file
          <input type="file" hidden accept=".srt,.vtt,.txt,text/plain,text/vtt,application/x-subrip" disabled={busy} onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {notSetUp && <TeamNote text={NOT_SET_UP} dev={NOT_SET_UP_DEV} />}
      {!notSetUp && !setup.summary && has && <TeamNote text={NO_SUMMARY} dev={NO_SUMMARY_DEV} />}
      {!canTranscribe && !has && <p className="muted small">This item has no recording stored on the site, so a transcript cannot be made automatically. Upload one instead: YouTube offers one under “Show transcript”, and most meeting tools export .vtt files.</p>}
      {state.status === "error" && state.error && !state.setup && <TeamNote {...forTeam(state.error)} alert />}
      {msg && <TeamNote {...forTeam(msg)} />}
    </section>
  );
}
