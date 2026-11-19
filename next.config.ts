import type { NextConfig } from "next";

// Set at build time. Netlify gives builds NETLIFY=true and URL, the site's main address (its
// custom domain once one is set); Vercel gives NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL.
const onNetlify = process.env.NETLIFY === "true";
const dev = process.env.NODE_ENV === "development";

// The database the browser talks to (REST, auth, storage and realtime over wss).
const supabase = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pdrvfjmhmauovehanyan.supabase.co"); }
  catch { return new URL("https://pdrvfjmhmauovehanyan.supabase.co"); }
})();
const supabaseWs = `${supabase.protocol === "http:" ? "ws:" : "wss:"}//${supabase.host}`;

/**
 * Content-Security-Policy. Scripts allow 'unsafe-inline' on purpose. A per-request nonce (set in
 * middleware) only works while every page renders per request; several pages declare `revalidate`
 * and render per request today only because the layout reads the session cookie. The day one of
 * them is prerendered or cached by the CDN, its HTML carries no nonce or a stale one, and Next's own
 * inline scripts are blocked: the page loses all interactivity with no error on the server.
 * Nothing in the app injects HTML (React escapes everything; the only dangerouslySetInnerHTML
 * are a constant theme script and qrcode's own SVG), so the rest of the policy carries the weight:
 * no plugins, no <base> hijack, no off-site form posts, no framing, scripts only from this site
 * and YouTube's player API.
 *
 * Pictures and media come from many hosts (event covers and avatars imported from Luma, X,
 * conference sites; recordings from signed storage addresses), so img-src and media-src stay https:.
 */
const csp = [
  "default-src 'self'",
  // YouTube IFrame API (components/transcript/MediaPlayers.tsx); Cloudflare Web Analytics if it is turned on
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://www.youtube.com https://static.cloudflareinsights.com https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  `connect-src 'self' ${supabase.origin} ${supabaseWs} https://cloudflareinsights.com${dev ? " ws:" : ""}`,
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://drive.google.com https://docs.google.com https://challenges.cloudflare.com",
  // pdf.js worker (lib/pdf.ts) is a same-origin file; it falls back to a blob: worker
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // no page is meant to be framed (the projector view is opened as its own window)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // the recorder uses the microphone and screen sharing; nothing uses the camera or location.
  // fullscreen and autoplay are left at their defaults so the YouTube and Drive embeds keep them.
  { key: "Permissions-Policy", value: "microphone=(self), display-capture=(self), camera=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), browsing-topics=()" },
  // a page that opens this site cannot keep a handle on it; popups this site opens still work
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "pdrvfjmhmauovehanyan.supabase.co" }] },
  // The event share image (app/events/[slug]/opengraph-image.tsx) reads its fonts from disk when it runs, which
  // file tracing cannot see; this ships them in that route's server bundle on Vercel and Netlify. The key is a
  // glob over the route path (brackets would be a character class, so the [slug] segment is a star).
  outputFileTracingIncludes: {
    "/events/*/opengraph-image*": ["./src/lib/cover/fonts/*.ttf"],
    "/share-image": ["./src/lib/cover/fonts/*.ttf"],
  },
  env: {
    HOSTING: onNetlify ? "netlify" : "",
    NETLIFY_SITE_URL: onNetlify ? process.env.URL ?? "" : "",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
