import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser, supabaseConfigured, supabaseServer } from "@/lib/supabase/server";
import { runAsk, type AskEvent } from "@/lib/ask/agent";
import { take, takeSearch, visitorsOff, type Tier } from "@/lib/ask/limit";
import { cleanHistory } from "@/lib/ask/history";
import { askMode } from "@/lib/ask/mode";
import { findWithHistory } from "@/lib/ask/find";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Most answers take 10 to 40 seconds; reading a long transcript can take longer. Netlify stops
// every request at 60 seconds, so there the lookups stop earlier and the answer is written from
// what was read. Times in ms: start no lookup after `budget`, drop a lookup still running when
// `reserve` is all that is left, stop at `deadline`.
export const maxDuration = 120;
const ON_NETLIFY = process.env.HOSTING === "netlify";
const TIMES = ON_NETLIFY ? { budgetMs: 20_000, reserveMs: 25_000, deadlineMs: 56_000 } : { budgetMs: 60_000, reserveMs: 40_000, deadlineMs: 114_000 };

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** The visitor's address as the host saw it; never a header the visitor could have set. */
function clientKey(req: Request) {
  const h = req.headers;
  let ip = (ON_NETLIFY ? h.get("x-nf-client-connection-ip") : h.get("x-vercel-forwarded-for") || h.get("x-real-ip"))?.split(",")[0]?.trim() || "unknown";
  // one IPv6 network (/64) counts as one visitor, as a single machine can have many addresses in it
  if (ip.includes(":")) ip = expand6(ip).slice(0, 4).join(":") + "::/64";
  return "ip:" + createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

function expand6(ip: string) {
  const [head, tail = ""] = ip.split("%")[0].split("::");
  const a = head ? head.split(":") : [], b = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b] : a;
  return groups.map((g) => (g || "0").toLowerCase().replace(/^0+(?=.)/, ""));
}

/**
 * POST /api/ask  { messages: [{ role, content }], page?: "/events/slug" }
 * Answers as newline-delimited JSON events (see AskEvent): a smart search of the site by default,
 * or Claude's written answer where that is switched on (mode.ts). Reads only what the caller's own
 * session may read, so a visitor never gets an answer drawn from a private or draft event.
 */
export async function POST(req: Request) {
  if (!supabaseConfigured) return fail("The database is not configured.", 503);

  let body: { messages?: unknown; page?: unknown };
  try { body = await req.json(); } catch { return fail("The question could not be read.", 400); }
  const history = cleanHistory(body.messages);
  if (typeof history === "string") return fail(history, 400);
  const page = typeof body.page === "string" && body.page.startsWith("/") ? body.page.slice(0, 300) : null;

  // currentUser() counts an anonymous session (a QR guest) as signed out: guests ask as visitors
  const { user, profile } = await currentUser();
  const tier: Tier = user ? (profile?.is_team || profile?.is_admin ? "team" : "signed-in") : "visitor";
  const who = user ? `u:${user.id}` : clientKey(req);
  let mode = askMode();
  let note = "";
  if (mode === "claude") {
    // Claude answers outside the team only with the counts in the database; anyone else, visitors
    // while ASK_PUBLIC=off, and anyone over a limit gets the search instead
    const refused = !user && visitorsOff() ? { status: 503 as const, error: "" } : await take(who, tier);
    if (refused) mode = "search";
    if (refused?.status === 429) note = "Written answers have reached their limit for now, so this is a plain search of the site.\n\n";
  }
  if (mode === "search") {
    const refused = takeSearch(who, tier);
    if (refused) return fail(refused.error, refused.status);
  }

  const sb = await supabaseServer();
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (e: AskEvent) => {
        if (!open) return;
        try { controller.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { open = false; }
      };
      const ctx = { sb, today: new Date().toISOString().slice(0, 10), sources: new Map(), links: new Set<string>() };
      try {
        if (mode === "search") {
          emit({ t: "status", text: "Searching the site…" });
          const found = await findWithHistory(ctx, history.filter((h) => h.role === "user").map((h) => h.content), page);
          emit({ t: "delta", text: note + found.markdown });
          // the links are in the answer itself; `links` lets the site's own outside addresses show as links
          emit({ t: "sources", items: [], links: [...ctx.links].slice(0, 200) });
          emit({ t: "done" });
        } else {
          await runAsk({ ctx, history, page, visitor: tier, emit, signal: req.signal, ...TIMES });
        }
      } catch (e) {
        if (mode === "search") console.warn("ask search failed:", e instanceof Error ? e.message : e);
        emit({ t: "error", text: mode === "search" ? "The search did not work just now. Try again in a moment." : "The assistant could not answer. Try again in a moment." });
      } finally {
        open = false;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
