import type { NextConfig } from "next";

// Set at build time. Netlify gives builds NETLIFY=true and URL, the site's main address (its
// custom domain once one is set); Vercel gives NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL.
const onNetlify = process.env.NETLIFY === "true";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
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
};

export default nextConfig;
