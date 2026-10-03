import type { ReactNode } from "react";

export type HoodKey = "config" | "icons" | "bundle" | "plist" | "car" | "exec" | "advanced";

export interface HoodNode {
  key: HoodKey;
  /** Tree guides for ancestor levels ("|" continues, " " ended) and this line's elbow (t = tee, l = last). */
  guides: string;
  elbow: "t" | "l";
  name: string;
  note: string;
  title: string;
  body: ReactNode[];
}

/** One entry per selectable line of the bundle listing, in listing order. */
export const HOOD_NODES: HoodNode[] = [
  {
    key: "config", guides: "", elbow: "t", name: "config.json", note: "every favorite: path, code, icon",
    title: "config.json",
    body: [
      "The app’s whole state: for every favorite, the folder’s path, the four-character code allocated to it, and the icon chosen for it.",
      <>Imported artwork sits beside it in <code>Icons/</code>. Settings links straight to the helper bundle, so you can open it in Finder and look for yourself.</>,
    ],
  },
  {
    key: "icons", guides: "", elbow: "t", name: "Icons/", note: "imported SVG artwork",
    title: "Icons/",
    body: [
      "The SVG files you import, kept as you gave them. They are compiled into the helper bundle’s symbol catalog; this folder is the source the app rebuilds from.",
    ],
  },
  {
    key: "bundle", guides: "", elbow: "t", name: "SidebarFavoritesIcons.app/", note: "the helper bundle, never launched",
    title: "SidebarFavoritesIcons.app",
    body: [
      "One small bundle for every favorite. It declares a type per favorite and nothing else, and it is never launched.",
      "That is the whole mechanism for a normal favorite: no extension, no daemon, no login item, no launch agent.",
    ],
  },
  {
    key: "plist", guides: "| ", elbow: "t", name: "Info.plist", note: "one UTI per favorite: code → SF Symbol",
    title: "Info.plist",
    body: [
      <>Each favorite’s Finder row carries a private property, <code>com.apple.LSSharedFileList.OverrideIcon.OSType</code>, holding its four-character code.</>,
      "Info.plist declares one UTI per favorite, tags it with that code and points it at an SF Symbol. Launch Services does the lookup, so Finder draws the glyph with no code of ours running.",
    ],
  },
  {
    key: "car", guides: "| ", elbow: "t", name: "Resources/Assets.car", note: "custom SVGs, compiled into a symbol catalog",
    title: "Resources/Assets.car",
    body: [
      "Your imported SVGs, compiled into a symbol catalog inside the bundle. A custom icon is just another symbol that a UTI can point to, exactly like the built-in SF Symbols.",
    ],
  },
  {
    key: "exec", guides: "| ", elbow: "l", name: "MacOS/SidebarFavoritesIcons", note: "17 bytes: #!/bin/sh, a no-op so macOS registers the bundle",
    title: "MacOS/SidebarFavoritesIcons",
    body: [
      <>The “executable” is 17 bytes: <code>#!/bin/sh</code> and a newline. It exists only so macOS agrees to register the bundle, and the bundle is never launched.</>,
      "The bundle contains no executable code of any kind. There is nothing in it that could run, so there is nothing running.",
    ],
  },
  {
    key: "advanced", guides: "", elbow: "l", name: "AdvancedApps/", note: "only with Both icons: a host app and a Finder Sync extension per favorite (≈ 6 MB; the host quits itself after registering)",
    title: "AdvancedApps/",
    body: [
      "Finder draws a sidebar row from a separate source when a Finder Sync extension claims that folder: the extension’s containing app icon. That path ignores the folder’s own icon, which is why the glyph survives.",
      "So Both icons generates one tiny host app plus extension per favorite, carrying that favorite’s artwork. The host quits itself a few seconds after registering; only the extension stays, at about 6 MB.",
      "The normal icon code stays on the row underneath, so if the helper is ever disabled the row falls back to it immediately.",
    ],
  },
];

export const HOOD_CHAIN = [
  "Favorites row",
  "OverrideIcon.OSType",
  "Launch Services",
  "SidebarFavoritesIcons.app (UTI)",
  "SF Symbol",
];
