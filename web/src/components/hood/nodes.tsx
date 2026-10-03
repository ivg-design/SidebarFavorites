export type HoodKey = "config" | "icons" | "backups" | "bundle" | "plist" | "exec" | "car" | "advanced";

export interface HoodNode {
  key: HoodKey;
  /** 0 = directly in SidebarFavorites/, 1 = inside the helper bundle. */
  depth: 0 | 1;
  name: string;
  note: string;
  /** What the panel shows: the thing's real content or format, then a sentence or two. */
  peek: string[];
  body: string;
}

/** The files the app writes under ~/Library/Application Support/SidebarFavorites/ (README "How it works", docs/ARCHITECTURE). */
export const HOOD_NODES: HoodNode[] = [
  {
    key: "config", depth: 0, name: "config.json", note: "the app’s state",
    peek: ["favorites    one per row: osType, provenance …", "settings", "helper       digest, generation"],
    body: "Each favorite stores the four-character code allocated to it, once, and never changes it. The file is written atomically, and a file that cannot be read is moved aside, never replaced.",
  },
  {
    key: "icons", depth: 0, name: "Icons/", note: "your imported SVGs",
    peek: ["my-mark.svg", "another.svg"],
    body: "Imported SVGs, kept verbatim as you supplied them. They are compiled into the helper bundle’s symbol catalog.",
  },
  {
    key: "backups", depth: 0, name: "IconBackups/", note: "a copy before “Remove its icon”",
    peek: ["IconBackups/  a copy of the folder’s own icon"],
    body: "Nothing is deleted until you press Save or Apply, and a copy of the folder’s icon is kept here first.",
  },
  {
    key: "bundle", depth: 0, name: "SidebarFavoritesIcons.app/", note: "the helper bundle, never launched",
    peek: ["Contents/", "  Info.plist", "  MacOS/SidebarFavoritesIcons", "  Resources/Assets.car"],
    body: "One small bundle for every favorite. It declares a type per favorite and nothing else. It has no executable code of any kind, and it is never launched.",
  },
  {
    key: "plist", depth: 1, name: "Contents/Info.plist", note: "one UTI per favorite",
    peek: ["UTExportedTypeDeclarations", "  one entry per enabled favorite:", "  code → SF Symbol"],
    body: "Each entry tags a type with the favorite’s code and points it at an SF Symbol. Launch Services does the lookup, so Finder draws the glyph with no code of ours running.",
  },
  {
    key: "exec", depth: 1, name: "Contents/MacOS/SidebarFavoritesIcons", note: "17 bytes, a no-op",
    peek: ["#!/bin/sh", "exit 0"],
    body: "17 bytes, and “no-op” is literal: the script does nothing and exits. It exists only so macOS agrees to register the bundle.",
  },
  {
    key: "car", depth: 1, name: "Contents/Resources/Assets.car", note: "custom SVGs as symbols",
    peek: ["compiled custom symbols", "absent when none are used"],
    body: "Your SVGs, compiled into a symbol catalog. A custom icon is another symbol that a type can point to, like the built-in SF Symbols.",
  },
  {
    key: "advanced", depth: 0, name: "AdvancedApps/", note: "only for Both icons",
    peek: ["one host app + Finder Sync extension", "per Both icons favorite, about 6 MB"],
    body: "Finder draws a row from a separate source when a Finder Sync extension claims the folder. The host quits itself seconds after registering; only the extension stays. The normal code stays on the row underneath.",
  },
];

export const HOOD_FACTS: [string, string][] = [
  ["Nothing to enable.", "No extension to switch on, no permission to grant, for a normal favorite."],
  ["Nothing running.", "The helper bundle is never launched. There is no daemon, no login item, no launch agent."],
  ["Icons survive reboots and Finder restarts.", "The code sits on the Finder row; Launch Services resolves it every time."],
  ["Quit the app and the icons stay.", "You open it only to add, edit or remove a favorite."],
];
