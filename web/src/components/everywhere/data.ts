export type Kind = "local" | "cloud" | "disk" | "share";

export interface EvRow {
  key: string; kind: Kind; label: string;
  /** glyph the app applies */
  glyph: string;
  /** what macOS draws by default: "folder" = the grey folder */
  base: "folder" | "drive" | "server";
  group: "Favorites" | "Locations";
  /** path split so the middle can truncate the way the app does: head shrinks, tail never does */
  head: string; tail: string;
  where: string;
  note: string;
}

export const ROWS: EvRow[] = [
  { key: "projects", kind: "local", label: "Projects", glyph: "hammer.fill", base: "folder", group: "Favorites", head: "~/", tail: "Projects", where: "A local folder",
    note: "Anything on your Mac. The app adds the row to Favorites with the glyph you picked. Rows you added yourself are left where they are; it only puts an icon on them." },
  { key: "contracts", kind: "cloud", label: "Contracts", glyph: "icloud", base: "folder", group: "Favorites", head: "~/Library/Mobile Documents/com~apple~CloudDocs/", tail: "Contracts", where: "A folder in iCloud Drive",
    note: "iCloud Drive and ~/Library/CloudStorage are virtual FileProvider mounts that a Finder Sync extension cannot see. Folders in them work exactly like local ones, which no version before 1.0 managed." },
  { key: "motion", kind: "cloud", label: "Motion Graphics", glyph: "paperplane.fill", base: "folder", group: "Favorites", head: "~/Library/CloudStorage/GoogleDrive-you@example.com/My Drive/", tail: "Motion Graphics", where: "A folder in Google Drive",
    note: "A CloudStorage folder, read straight from the real path. Point the favorite at the folder itself; the old symlink workaround is no longer needed." },
  { key: "brand", kind: "cloud", label: "Brand Assets", glyph: "bookmark.fill", base: "folder", group: "Favorites", head: "~/Library/CloudStorage/Dropbox/", tail: "Brand Assets", where: "A folder in Dropbox",
    note: "Dropbox, OneDrive and the other providers under ~/Library/CloudStorage behave the same way." },
  { key: "disk", kind: "disk", label: "WORK2TBSSD", glyph: "briefcase.fill", base: "drive", group: "Locations", head: "/Volumes/", tail: "WORK2TBSSD", where: "A mounted disk",
    note: "Finder already lists every mounted volume under Locations, so a volume favorite offers a choice. Leave it off and the app adds a Favorites row and icons the Locations row to match. Choose Show in Locations only and it adds no row at all, it just icons the one Finder shows." },
  { key: "share", kind: "share", label: "Studio NAS", glyph: "photo", base: "server", group: "Locations", head: "/Volumes/", tail: "Studio NAS", where: "A network share",
    note: "A server works like a disk. Finder owns the rows in Locations, so the app only ever patches one in place: it never inserts, moves or deletes a row, and hands it back untouched when the favorite is removed." },
];
