import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/kleros";

// Public pages are open to search engines; the team area, sign-in and personal pages are not worth crawling.
export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/record", "/saved", "/me", "/login", "/auth", "/api", "/f/", "/q/", "/session/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
