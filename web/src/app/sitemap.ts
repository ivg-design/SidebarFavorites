// OWNER: worker D. Landing, /docs, every /docs/<slug>, /changelog.
import type { MetadataRoute } from "next";
import { toCanonicalUrl } from "@/lib/seo";
import { docPages, docUrl } from "@/content/docs";

export const dynamic = "force-static";

const LAST_MODIFIED = new Date("2026-10-02");

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = docPages.map(({ slug }) => ({
    url: toCanonicalUrl(docUrl(slug)),
    lastModified: LAST_MODIFIED,
    changeFrequency: "monthly" as const,
    priority: slug === "quick-start" ? 0.9 : 0.7,
  }));
  return [
    { url: toCanonicalUrl("/"), lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 1 },
    ...docs,
    { url: toCanonicalUrl("/changelog"), lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 0.6 },
  ];
}
