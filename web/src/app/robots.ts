import type { MetadataRoute } from "next";
import { toCanonicalUrl } from "@/lib/seo";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: toCanonicalUrl("/sitemap.xml") };
}
