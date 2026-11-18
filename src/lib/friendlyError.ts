import { fmtSize } from "./format";

// Plain words for what can go wrong in the team's tools for adding things to events (agenda,
// roster, files, links, recordings). The live Q&A has its own list in qaErrors.ts.

/** Uploaded files must stay under this (the storage plan's limit). */
export const MAX_UPLOAD_BYTES = 50e6;

export const NO_ACCESS = "This account cannot change this. Check that you are signed in with the email address that has access.";
const SIGNED_OUT = "Your sign-in expired. Sign in again and retry.";
const TOO_BIG = "This file is over 50 MB. Upload it to Google Drive or YouTube and add the link instead.";
const OFFLINE = "No connection. Check the wifi and try again.";

/** Said before uploading, so a file over the limit is skipped instead of failing half way. */
export const tooBigFile = (f: { name: string; size: number }) =>
  `${f.name} is ${fmtSize(f.size)}. Files must be under 50 MB. Upload it to Drive or YouTube and use Add a link or post.`;

/** The error's own text, whatever shape it comes in (an Error, a Supabase error, a string). */
function rawText(e: unknown) {
  if (typeof e === "string") return e;
  const o = (e ?? {}) as { message?: unknown };
  if (typeof o.message === "string") return o.message;
  return e == null || typeof e === "object" ? "" : String(e);
}

export function friendlyError(raw: unknown): string {
  const m = rawText(raw).trim();
  const o = (raw && typeof raw === "object" ? raw : {}) as { code?: unknown; status?: unknown; statusCode?: unknown };
  const code = typeof o.code === "string" ? o.code : "";
  const status = String(o.statusCode ?? o.status ?? "");
  const all = `${m} ${code} ${status}`;
  // the database's own refusals (too many questions or votes, a reserved name) are written to be shown as they are
  if ((code === "PT429" || code === "PT422") && m) return m;
  if (/row-level security|permission denied/i.test(m)) return NO_ACCESS;
  if (/JWT expired|invalid JWT|refresh token|session|not authenticated/i.test(m) || status === "401") return SIGNED_OUT;
  if (/duplicate key|\b23505\b/i.test(all)) return "That is already there.";
  if (/maximum allowed size|\b413\b|payload too large/i.test(all)) return TOO_BIG;
  if (/failed to fetch|network|load failed/i.test(m)) return OFFLINE;
  // Refusals written for people ("This item belongs only to a private event. ...") are full
  // sentences, and so are messages the site's own code throws. Built-in database and browser
  // errors do not end with a period, so they fall through to the lines below.
  if (/^[A-Z]\S*(\s+\S+){2,}\.$/.test(m)) return m;
  if (/\b42501\b/.test(all)) return NO_ACCESS;
  const extra = code && !m.includes(code) ? ` (${code})` : "";
  return `Something went wrong. Try again. If it keeps happening, send Wei Wei this: ${m || "no details"}${extra}`;
}
