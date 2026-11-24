import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /events/<slug> and /talks/<id> themselves, not what sits under them (host, live, screen, calendar.ics, share image).
// With a session they are built for the person (app/session/...), with their own access.
const SESSION_COPY = /^\/(events|talks)\/[^/]+\/?$/;

// Refreshes the Supabase session cookie on every request that carries one.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;
  // A visitor with no session (most of them) has nothing to refresh, and gets the event and talk pages that are
  // built ahead for everyone (app/events/[slug], app/talks/[id]), ready at once.
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))) return response;
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // getClaims checks the sign-in token here when the project signs tokens with a public key, instead of asking
  // the auth server (in Ireland) on every click; otherwise it asks, as getUser did. Either way an expired
  // session is refreshed first. Pages that need the user still check it themselves (currentUser).
  await sb.auth.getClaims();
  const own = SESSION_COPY.exec(request.nextUrl.pathname);
  if (own) {
    const url = request.nextUrl.clone();
    url.pathname = `/session${request.nextUrl.pathname}`;
    const rewritten = NextResponse.rewrite(url, { request });
    // keep any refreshed session cookie
    response.cookies.getAll().forEach((c) => rewritten.cookies.set(c));
    return rewritten;
  }
  return response;
}

// /f/ (stored files) refreshes the session itself, once per file instead of twice.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|f/|.*\\.(?:svg|png|jpg|pdf|mjs)$).*)"],
};
