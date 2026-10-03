import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import Table from "@/components/docs/Table";
import { H2 } from "@/components/docs/Headings";

export const meta: DocMeta = {
  slug: "config-json",
  title: "config.json",
  group: "Reference",
  description: "Where SidebarFavorites keeps your favorites and settings, what each field means, and what happens if the file cannot be read.",
  keywords: ["config", "configuration", "json", "application support", "settings", "backup", "corrupt", "reveal backup", "osType", "iconScale", "locationsOnly", "mode", "icons folder"],
  excerpt: "Favorites and settings live in ~/Library/Application Support/SidebarFavorites/config.json, written atomically. An unreadable file is moved aside, never wiped.",
  sections: [
    { id: "location", title: "Where it lives" },
    { id: "top-level", title: "Top-level fields" },
    { id: "settings", title: "Settings" },
    { id: "favorites", title: "Favorites" },
    { id: "if-unreadable", title: "If the file cannot be read" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="location">Where it lives</H2>
      <CodeBlock label="Files on disk" code={`~/Library/Application Support/SidebarFavorites/
  config.json                       favorites, settings, helper digest + generation
  config.pre-1.0.json               pre-migration backup (written once)
  config.corrupt-<timestamp>.json   an unreadable config, moved aside
  Icons/                            imported SVGs, verbatim as you supplied them
  SidebarFavoritesIcons.app         the helper bundle
  AdvancedApps/                     Both-icons helpers`} />
      <p>The file is written atomically.</p>
      <H2 id="top-level">Top-level fields</H2>
      <Table label="Top-level config fields">
        <thead><tr><th>Field</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td><code>version</code></td><td>Schema version written by this build.</td></tr>
          <tr><td><code>favorites</code></td><td>The list of favorites (below).</td></tr>
          <tr><td><code>settings</code></td><td>App settings (below).</td></tr>
          <tr><td><code>helperDigest</code></td><td>SHA-256 of the declarations that produced the helper bundle on disk. An unchanged digest skips the whole rebuild.</td></tr>
          <tr><td><code>helperGeneration</code></td><td>A counter written as the helper bundle&rsquo;s version, bumped on every rebuild so Launch Services sees a new record.</td></tr>
        </tbody>
      </Table>
      <H2 id="settings">Settings</H2>
      <Table label="Settings fields">
        <thead><tr><th>Field</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td><code>launchAtLogin</code></td><td>The Launch at Login switch in Settings. Off by default.</td></tr>
          <tr><td><code>showInMenuBar</code></td><td>The Show in Menu Bar switch in Settings. On by default.</td></tr>
          <tr><td><code>signingIdentity</code></td><td>One of <code>automatic</code> (the default), <code>-</code> (ad-hoc), <code>Apple Development</code> or <code>Developer ID Application</code>.</td></tr>
        </tbody>
      </Table>
      <H2 id="favorites">Favorites</H2>
      <Table label="Favorite fields">
        <thead><tr><th>Field</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td><code>id</code>, <code>name</code>, <code>folderPath</code></td><td>Identity, the row label, and the folder.</td></tr>
          <tr><td><code>iconType</code>, <code>iconValue</code></td><td><code>sfSymbol</code> or <code>custom</code>, and the symbol name.</td></tr>
          <tr><td><code>customSVGPath</code></td><td>For custom icons, the path of the stored SVG relative to <code>Icons/</code>.</td></tr>
          <tr><td><code>enabled</code>, <code>createdAt</code>, <code>updatedAt</code></td><td>Whether it is active, and timestamps.</td></tr>
          <tr><td><code>osType</code></td><td>The private four-character code bound to this favorite&rsquo;s icon. Allocated once and never changed.</td></tr>
          <tr><td><code>sidebarItemID</code></td><td>The identifier of the sidebar row this favorite is bound to, stable across launches.</td></tr>
          <tr><td><code>sidebarProvenance</code></td><td><code>managed</code> (the app inserted the row), <code>adopted</code> (the row was already there) or <code>unbound</code> (no row). This decides what removal does.</td></tr>
          <tr><td><code>locationsOnly</code></td><td>For a mounted volume: icon Finder&rsquo;s Locations row and add no Favorites row.</td></tr>
          <tr><td><code>iconScale</code></td><td>The size correction for custom artwork, between 0.5 and 1.5. Default 1.0.</td></tr>
          <tr><td><code>mode</code></td><td><code>regular</code> or <code>advanced</code> (Both icons).</td></tr>
        </tbody>
      </Table>
      <H2 id="if-unreadable">If the file cannot be read</H2>
      <p>A decode failure never wipes your favorites. The file is moved aside as <code>config.corrupt-&lt;timestamp&gt;.json</code> and Settings shows a banner with a <strong>Reveal Backup</strong> button. Older config files with missing fields load without tripping this path.</p>
    </>
  );
}
