import { REPO_URL } from "./config";

const API = "https://api.github.com/repos/ivg-design/SidebarFavorites/releases/latest";

export interface SiteRelease {
  version: string;
  dmgUrl: string;
  dmgName: string;
  sizeLabel: string;
  date: string | null;
}

const FALLBACK: SiteRelease = {
  version: "1.3.0",
  dmgName: "SidebarFavorites-1.3.0.dmg",
  dmgUrl: `${REPO_URL}/releases/download/v1.3.0/SidebarFavorites-1.3.0.dmg`,
  sizeLabel: "14 MB",
  date: "2026-08-01",
};

function formatSize(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/** Latest GitHub release at build time (revalidated hourly), with a pinned 1.3.0 fallback. */
export async function getSiteRelease(): Promise<SiteRelease> {
  try {
    const res = await fetch(API, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return FALLBACK;
    const r = await res.json();
    const dmg = (r.assets ?? []).find((a: { name: string }) => a.name.toLowerCase().endsWith(".dmg"));
    if (!dmg) return FALLBACK;
    return {
      version: String(r.tag_name).replace(/^v/, ""),
      dmgName: dmg.name,
      dmgUrl: dmg.browser_download_url,
      sizeLabel: formatSize(dmg.size),
      date: r.published_at ? String(r.published_at).slice(0, 10) : null,
    };
  } catch {
    return FALLBACK;
  }
}
