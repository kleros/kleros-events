"use client";
// Cloudflare Turnstile, the bot check Supabase asks for on sign-in and on guest sessions once CAPTCHA protection is
// on (Supabase > Authentication > Attack Protection). The site key is public; the secret lives only in Supabase.
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY nothing loads and no token is sent, so the site works the same as before.
// Most visitors never see anything: the check runs in the background and shows a small box only when Cloudflare
// wants a click. Each token works once, so every sign-in or guest session asks for a new one.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(id: string): void;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

let loading: Promise<TurnstileApi> | null = null;
function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise<TurnstileApi>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("The bot check did not load.")));
      s.onerror = () => { loading = null; reject(new Error("Could not load the bot check. Check the connection and try again.")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export const captchaEnabled = () => SITE_KEY !== "";

/** A one-time Turnstile token, or undefined when no site key is set. */
export async function captchaToken(action: string): Promise<string | undefined> {
  if (!SITE_KEY || typeof window === "undefined") return undefined;
  const ts = await load();
  const box = document.createElement("div");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Quick check that you are a person");
  box.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000";
  document.body.appendChild(box);
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The bot check took too long. Try again.")), 120_000);
      const id = ts.render(box, {
        sitekey: SITE_KEY,
        action,
        appearance: "interaction-only",
        execution: "render",
        callback: (token: string) => { clearTimeout(timer); resolve(token); },
        "error-callback": () => { clearTimeout(timer); reject(new Error("The bot check failed. Reload the page and try again.")); },
        "expired-callback": () => { clearTimeout(timer); reject(new Error("The bot check expired. Try again.")); },
      });
      box.dataset.widget = id;
    });
  } finally {
    const id = box.dataset.widget;
    if (id) try { ts.remove(id); } catch { /* already gone */ }
    box.remove();
  }
}
