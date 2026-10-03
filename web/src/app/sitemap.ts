// OWNER: worker D (must list landing, /docs, every /docs/<slug>, /changelog).
import type { MetadataRoute } from "next";
import { toCanonicalUrl } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap { return [{ url: toCanonicalUrl("/") }]; }
