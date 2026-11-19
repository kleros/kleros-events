import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Instrument_Serif, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./styles/console.css";
import "./styles/admin.css";
import "./styles/transcript.css";
import "./styles/studio.css";
import "./styles/ask.css";
import "./styles/media.css";
import "./styles/event-pages.css";
import "./styles/people.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AskLauncher from "@/components/ask/AskLauncher";
import { SITE_URL } from "@/lib/kleros";

// the site's own share picture (app/share-image/route.tsx); event pages swap in their own
const SHARE_IMAGE = { url: "/share-image", width: 1200, height: 630, alt: "Kleros Events" };

// Kleros house faces: Instrument Serif for display, Geist for text, a mono for chips.
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display" });
const body = Geist({ subsets: ["latin"], variable: "--font-body" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Kleros Events", template: "%s · Kleros Events" },
  description: "Every event Kleros hosts or takes part in, with the talks, slides and recordings to match.",
  openGraph: { siteName: "Kleros Events", type: "website", images: [SHARE_IMAGE] },
  // no twitter image here: X falls back to og:image, and event pages keep their own (Next copies it over)
  twitter: { card: "summary_large_image", site: "@kleros_io" },
};

// A saved light or dark choice goes on <html> before the first paint. With none, CSS color-scheme follows the OS.
// There is no CSP today; if one is added, this inline script needs a nonce.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

// the browser bar on phones takes the page background of the theme in use (ThemeToggle updates it for a saved choice)
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF9FB" },
    { media: "(prefers-color-scheme: dark)", color: "#15121B" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body>
        {/* first stop for the keyboard: past the header and menu to the page itself */}
        <a className="skip" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>{children}</main>
        <SiteFooter />
        {/* checks the question counter (up to 2 s) without holding up the page */}
        <Suspense fallback={null}><AskLauncher /></Suspense>
      </body>
    </html>
  );
}
