import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/checkout", "/api/stripe", "/opt-out"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
