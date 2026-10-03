/** Phrases that must never break across lines (owner rule). Keep in sync with tests/nowrap.mjs. */
export const NOWRAP_PHRASES = [
  "IVG Design", "SidebarFavorites Manager", "SF Symbols", "SF Symbol", "Apple Silicon", "iCloud Drive", "Google Drive",
  "macOS 13+", "macOS 13", "macOS 26", "Launch Services", "System Settings", "Finder Sync", "Developer ID", "Login Items",
  "Get Info", "Restart Finder", "Browse All…", "Import SVG…", "Both icons", "Remove All Sidebar Icons",
] as const;

const NBSP = " ";

/** Replace the spaces inside every protected phrase with no-break spaces. Idempotent; safe on any prose string. */
export function nb(text: string): string {
  let out = text;
  for (const p of NOWRAP_PHRASES) {
    if (!p.includes(" ")) continue;
    out = out.split(p).join(p.replaceAll(" ", NBSP));
  }
  return out;
}
