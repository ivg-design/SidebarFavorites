export const basePath = "/apps/sidebarfavorites";

const isDev = process.env.NODE_ENV === "development";
const isForge = process.env.NEXT_PUBLIC_SITE_URL?.includes("forge.mograph.life") ?? false;

/** Prefix a public path when the site is served under forge.mograph.life/apps/sidebarfavorites. */
export function asset(path: string): string {
  if (isDev || !isForge) return path;
  return `${basePath}${path}`;
}

export const REPO_URL = "https://github.com/ivg-design/SidebarFavorites";
export const RELEASES_URL = `${REPO_URL}/releases`;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const BREW_CMD = "brew install --cask sidebarfavorites";
export const BREW_LINES = [
  "brew tap ivg-design/tap",
  "brew trust ivg-design/tap",
  "brew install --cask sidebarfavorites",
];
export const DEMO_VIDEO_SRC: string | null = null; // the recording does not exist yet
