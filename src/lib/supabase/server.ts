import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key",
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a server component; middleware refreshes the session instead
          }
        },
      },
    },
  );
}

/**
 * Who is signed in, from the session cookie: getClaims checks the sign-in token here, against the project's public
 * signing key (fetched once and kept), so there is no trip to the auth server on every page. A token signed the old
 * way is still checked with the auth server. The database checks every read and write itself either way.
 * Anonymous sessions (QR guests asking a question) count as signed out. Cached per request.
 */
export const sessionUser = cache(async (): Promise<User | null> => {
  if (!supabaseConfigured) return null;
  const sb = await supabaseServer();
  const { data } = await sb.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub || c.is_anonymous) return null;
  // the fields the site reads (id, email, is_anonymous), from the checked token
  return {
    id: c.sub, email: typeof c.email === "string" ? c.email : undefined, is_anonymous: false,
    aud: typeof c.aud === "string" ? c.aud : "authenticated", role: typeof c.role === "string" ? c.role : undefined,
    app_metadata: (c.app_metadata ?? {}) as User["app_metadata"], user_metadata: (c.user_metadata ?? {}) as User["user_metadata"],
    created_at: "",
  } as User;
});

/**
 * The signed-in user and their profile (select * includes is_team and is_admin), one read from the database.
 * Cached per request, so the header, admin layout and page share one lookup.
 */
export const currentUser = cache(async () => {
  const user = await sessionUser();
  if (!user) return { user: null, profile: null };
  const sb = await supabaseServer();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { user, profile };
});
