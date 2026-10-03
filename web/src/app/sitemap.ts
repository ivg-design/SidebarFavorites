// OWNER: worker D. Landing, /docs, every /docs/<slug>, /changelog.
import type { MetadataRoute } from "next";
import { toCanonicalUrl } from "@/lib/seo";

export const dynamic = "force-static";

// Fallback list (kept in sync with src/content/docs once that module exists).
const DOC_SLUGS = [
  "quick-start", "install", "updates", "custom-svg-icons", "cloud-folders", "disks-and-shares",
  "keeping-both-icons", "menu-bar-popover", "how-it-works", "config-json", "uninstalling",
  "building-from-source", "nix-flake", "troubleshooting", "faq", "report-an-issue",
];
const LAST_MODIFIED = new Date("2026-10-02");

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = DOC_SLUGS.map((slug) => ({
    url: toCanonicalUrl(slug === "quick-start" ? "/docs" : `/docs/${slug}`),
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
