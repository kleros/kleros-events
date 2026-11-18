"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Light and dark theme. With no saved choice the site follows the OS (CSS color-scheme, also with JS off);
 *  a choice is kept in localStorage and set as data-theme on <html> by the script in the root layout,
 *  before the first paint. */
type Choice = "system" | "light" | "dark";
const LIGHT = "#FAF9FB";
const DARK = "#15121B";

const effective = () =>
  document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function saved(): "light" | "dark" | null {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/**
 * The phone browser bar follows the chosen theme, not only the OS. The team console and the
 * projector are always dark, and so is the site in a browser without light-dark().
 */
function syncMeta() {
  const forced = !!document.querySelector(".console, .scr-page") || !CSS.supports("color", "light-dark(#000, #fff)");
  const t = forced ? "dark" : document.documentElement.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const own = (m.getAttribute("media") ?? "").includes("light") ? LIGHT : DARK;
    const c = t ? (t === "dark" ? DARK : LIGHT) : own;
    // only on a change, so the observer below does not wake itself
    if (m.getAttribute("content") !== c) m.setAttribute("content", c);
  });
}

export function applyTheme(c: Choice) {
  const root = document.documentElement;
  // no colour transitions while every token changes at once
  root.classList.add("theme-switching");
  if (c === "system") {
    root.removeAttribute("data-theme");
    try { localStorage.removeItem("theme"); } catch { /* storage blocked: the choice lasts for this page */ }
  } else {
    root.dataset.theme = c;
    try { localStorage.setItem("theme", c); } catch { /* storage blocked: the choice lasts for this page */ }
  }
  syncMeta();
  window.dispatchEvent(new Event("kleros-theme"));
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}

/** Reads the theme after mount (null before, so the server and first client render match). */
function useTheme() {
  const [state, setState] = useState<{ choice: Choice; dark: boolean } | null>(null);
  const path = usePathname();
  // Next writes the theme-color tags again on every page change: set them back to the choice
  useEffect(() => {
    syncMeta();
    const id = requestAnimationFrame(syncMeta);
    return () => cancelAnimationFrame(id);
  }, [path]);
  useEffect(() => {
    const root = document.documentElement;
    const s = saved();
    if (s && root.dataset.theme !== s) root.dataset.theme = s;
    const read = () => {
      const t = root.dataset.theme;
      setState({ choice: t === "light" || t === "dark" ? t : "system", dark: effective() === "dark" });
    };
    read();
    syncMeta();
    const head = new MutationObserver(syncMeta);
    head.observe(document.head, { childList: true, subtree: true });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("kleros-theme", read);
    mq.addEventListener("change", read);
    return () => {
      head.disconnect();
      window.removeEventListener("kleros-theme", read);
      mq.removeEventListener("change", read);
    };
  }, []);
  return state;
}

const ICON = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false } as const;

/** The header's one-click switch. CSS shows the moon in light (a click goes dark) and the sun in dark. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme();
  return (
    <button type="button" className={"icon-btn theme-toggle " + className} aria-label="Dark theme" aria-pressed={theme ? theme.dark : undefined}
      onClick={() => applyTheme(effective() === "dark" ? "light" : "dark")}>
      <svg className="i-moon" {...ICON}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
      <svg className="i-sun" {...ICON}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
    </button>
  );
}

const CHOICES: { c: Choice; label: string }[] = [{ c: "system", label: "System" }, { c: "light", label: "Light" }, { c: "dark", label: "Dark" }];

/** System, Light or Dark: in the footer and the phone menu. */
export function ThemeChoice() {
  const theme = useTheme();
  return (
    <div className="theme-choice" role="group" aria-label="Theme">
      <span aria-hidden="true">Theme</span>
      {CHOICES.map(({ c, label }) => (
        <button key={c} type="button" aria-pressed={theme ? theme.choice === c : undefined} onClick={() => applyTheme(c)}>{label}</button>
      ))}
    </div>
  );
}
