import { nb } from "@/lib/nowrap";

export type Kind = "local" | "cloud" | "disk" | "share";
export type Group = "Favorites" | "iCloud" | "Locations";

export interface EvRow {
  key: string; label: string; group: Group; kind: Kind;
  /** custom glyph the app applies; absent on Finder's own synthesised rows */
  glyph?: string;
  /** glyph macOS draws by default (when no custom icon): "folder" = the grey folder */
  base: string;
  own?: boolean;        // Finder's own synthesised row: cannot take an icon
  eject?: boolean;
  /** Favorites row that only exists while "Show in Locations only" is off */
  favOf?: "disk" | "share";
}

export const ROWS: EvRow[] = [
  { key: "desktop", label: "Desktop", group: "Favorites", kind: "local", glyph: "desktopcomputer", base: "folder" },
  { key: "projects", label: "Projects", group: "Favorites", kind: "local", glyph: "hammer.fill", base: "folder" },
  { key: "invoices", label: "Invoices", group: "Favorites", kind: "local", glyph: "doc.text.magnifyingglass", base: "folder" },
  { key: "gdrive-fav", label: "Google Drive", group: "Favorites", kind: "cloud", glyph: "icloud", base: "folder" },
  { key: "shoots", label: "Shoots", group: "Favorites", kind: "local", glyph: "camera", base: "folder" },
  { key: "fav-work2tbssd", label: "WORK2TBSSD", group: "Favorites", kind: "disk", glyph: "briefcase.fill", base: "folder", favOf: "disk" },
  { key: "fav-studio-nas", label: "Studio NAS", group: "Favorites", kind: "share", glyph: "photo", base: "folder", favOf: "share" },
  { key: "icloud-drive", label: "iCloud Drive", group: "iCloud", kind: "cloud", base: "icloud", own: true },
  { key: "gdrive", label: "Google Drive", group: "iCloud", kind: "cloud", base: "folder.fill", own: true },
  { key: "dropbox", label: "Dropbox", group: "iCloud", kind: "cloud", base: "archivebox.fill", own: true },
  { key: "onedrive", label: "OneDrive", group: "iCloud", kind: "cloud", base: "globe", own: true },
  { key: "work2tbssd", label: "WORK2TBSSD", group: "Locations", kind: "disk", glyph: "briefcase.fill", base: "drive", eject: true },
  { key: "studio-nas", label: "Studio NAS", group: "Locations", kind: "share", glyph: "photo", base: "server" },
  { key: "network", label: "Network", group: "Locations", kind: "share", base: "globe", own: true },
];

export const KINDS: { kind: Kind; label: string; sub: string }[] = [
  { kind: "local", label: "Local folders", sub: "Anything on your Mac" },
  { kind: "cloud", label: "iCloud & CloudStorage", sub: "Virtual FileProvider folders" },
  { kind: "disk", label: "Mounted disks", sub: "Rows Finder keeps in Locations" },
  { kind: "share", label: "Network shares", sub: "Servers, same rule as disks" },
];

export const NOTES: Record<Kind, string> = {
  local: nb("Anything on your Mac. The app adds the row to Favorites with the glyph you picked, or puts the icon on a row you added yourself and leaves it where it is. Nothing runs in the background, so the icons survive reboots and Finder restarts."),
  cloud: nb("Folders in iCloud Drive and ~/Library/CloudStorage (Google Drive, Dropbox, OneDrive) work exactly like local ones. Finder’s own rows under iCloud, tagged in the picture, are different: iCloud Drive and the cloud-provider rows cannot take a custom icon at all. macOS stores one and never draws it, so the app leaves them alone."),
  disk: nb("A mounted disk can carry a custom icon too. Finder already lists every volume under Locations, so a volume favorite offers a choice, and the switch below shows both."),
  share: nb("A server works like a disk: Studio NAS can carry a custom icon, in Favorites and in Locations. Network is one of Finder’s own rows, tagged in the picture, so it keeps its default icon."),
};

export const LOC_ON = nb("Switch on: no Favorites row is added at all. The app only icons the row Finder already shows under Locations.");
export const LOC_OFF = nb("Switch off: the app adds a row under Favorites and icons Finder’s Locations row to match, so both agree.");
export const LOC_OWN = nb("Finder owns the rows in Locations. The app only ever patches one in place: it never inserts, moves or deletes a row there, and hands it back untouched when the favorite is disabled or removed.");
