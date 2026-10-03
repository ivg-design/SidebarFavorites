import type { Metadata } from "next";
import { basePath } from "./config";

export const CANONICAL_HOST = "https://forge.mograph.life";

export function toCanonicalUrl(path = ""): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p === "/" ? `${CANONICAL_HOST}${basePath}/` : `${CANONICAL_HOST}${basePath}${p}`;
}

export const OG_IMAGE = {
  url: toCanonicalUrl("/og.png"),
  width: 1200,
  height: 630,
  alt: "SidebarFavorites: Your sidebar, finally legible.",
};

export function docMetadata(slug: string, title: string, description: string): Metadata {
  const url = toCanonicalUrl(slug === "quick-start" ? "/docs" : `/docs/${slug}`);
  const pageTitle = `${title} | SidebarFavorites Docs`;
  return {
    title: pageTitle,
    description,
    alternates: { canonical: url },
    openGraph: { title: pageTitle, description, url, type: "article", siteName: "SidebarFavorites", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: pageTitle, description, images: [OG_IMAGE.url] },
  };
}
