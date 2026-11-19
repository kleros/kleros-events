"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * The signed-in visitor's saved talks and files (0016 material_saves), loaded once per page and shared by
 * every Save button on it. `ready` is false while loading, and stays false for signed-out visitors, QR guests
 * and when the table is not there yet (0016 not run), so the buttons stay hidden instead of failing.
 */
type State = { ready: boolean; user: string | null; ids: Set<string> };
let state: State = { ready: false, user: null, ids: new Set() };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

/** True when the error says the table or column is missing: the migration has not run yet. */
export const notThereYet = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || /does not exist|schema cache/i.test(e.message ?? ""));

async function load() {
  const sb = supabaseBrowser();
  const { data: { session } } = await sb.auth.getSession();
  const u = session?.user;
  if (!u || u.is_anonymous) { state = { ready: false, user: null, ids: new Set() }; emit(); return; }
  const { data, error } = await sb.from("material_saves").select("material_id");
  state = error ? { ready: false, user: u.id, ids: new Set() } : { ready: true, user: u.id, ids: new Set((data ?? []).map((r) => r.material_id as string)) };
  emit();
}

export function useSaves() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    listeners.add(f);
    loading ??= load();
    return () => { listeners.delete(f); };
  }, []);
  return state;
}

/** Saves or unsaves one item; returns an error message or null. */
export async function toggleSave(id: string): Promise<string | null> {
  if (!state.user) return "Sign in to save";
  const sb = supabaseBrowser();
  const on = state.ids.has(id);
  const res = on
    ? await sb.from("material_saves").delete().eq("user_id", state.user).eq("material_id", id)
    : await sb.from("material_saves").insert({ material_id: id });
  if (res.error) return "Not saved. Try again in a moment.";
  const ids = new Set(state.ids);
  if (on) ids.delete(id); else ids.add(id);
  state = { ...state, ids };
  emit();
  return null;
}
