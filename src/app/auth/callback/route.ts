import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/format";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const code = params.get("code");
  const next = safeNext(params.get("next"));
  // Supabase adds these to the link when it is expired, already used or otherwise bad.
  const linkError = params.has("error") || params.has("error_code") || params.has("error_description");
  let ok = false;
  if (code && !linkError) {
    const sb = await supabaseServer();
    // fails when the link was opened in another browser (no sign-in cookie) or used twice
    const { error } = await sb.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  if (!ok) {
    // an old sign-in email opened again by someone who is still signed in: just go on
    const { data } = await (await supabaseServer()).auth.getUser();
    if (data.user && !data.user.is_anonymous) {
      const dest = new URL(next, url.origin);
      return NextResponse.redirect(dest.origin === url.origin ? dest : new URL("/me", url.origin));
    }
    const back = new URL("/login", url.origin);
    back.searchParams.set("next", next);
    back.searchParams.set("failed", "1");
    return NextResponse.redirect(back);
  }
  const dest = new URL(next, url.origin);
  return NextResponse.redirect(dest.origin === url.origin ? dest : new URL("/me", url.origin));
}
