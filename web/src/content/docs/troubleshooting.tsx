import type { DocMeta } from "./types";
import Callout from "@/components/docs/Callout";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "troubleshooting",
  title: "Troubleshooting",
  group: "Help",
  description: "Fixes for the common problems: Finder showing the old icon, a glyph that disappears, a refused folder, SVG warnings and helper status.",
  keywords: ["problem", "fix", "old icon", "restart finder", "glyph disappears", "macos 26", "duplicate", "refused", "svg warning", "helper", "login items", "refresh", "locations", "icloud drive", "not working", "wrong icon"],
  excerpt: "Finder shows the old icon: use the Restart Finder banner. The glyph disappears on macOS 26: keep both icons, remove the folder's icon, or press Refresh.",
  sections: [
    { id: "old-icon", title: "Finder still shows the old icon" },
    { id: "glyph-disappears", title: "The glyph disappears from a folder" },
    { id: "folder-refused", title: "The folder is refused when I add it" },
    { id: "locations-row", title: "A Locations row will not take an icon" },
    { id: "svg-warnings", title: "My SVG shows warnings or looks wrong" },
    { id: "helper-status", title: "A helper shows as not enabled" },
    { id: "after-uninstall", title: "Helpers remain after uninstalling" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="old-icon">Finder still shows the old icon</H2>
      <p>A banner with a <strong>Restart Finder</strong> button appears when Finder owes a redraw. Press it. The app never restarts Finder on its own, because that would abort a copy in progress and close your windows and tabs. The same action is in Settings, and the editor&rsquo;s <strong>Apply</strong> button restarts Finder for you when you press it.</p>
      <H2 id="glyph-disappears">The glyph disappears from a folder</H2>
      <p>On macOS 26, a folder that carries an icon of its own makes Finder redraw the row from that icon whenever the folder changes, and your glyph disappears. You have three ways out, all in the editor:</p>
      <ul>
        <li><strong>Keep both icons</strong> switches the favorite to Both icons mode.</li>
        <li><strong>Remove its icon</strong> returns the folder to a plain icon (a copy is kept in <code>IconBackups/</code>).</li>
        <li><strong>Leave as is</strong> accepts that the glyph disappears until you press <strong>Refresh</strong>.</li>
      </ul>
      <p>Details: <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>
      <H2 id="folder-refused">The folder is refused when I add it</H2>
      <p>The same folder cannot be added twice. Two favorites on one folder fight over a single sidebar row, so Add is refused with a note naming the favorite that already uses the folder. Edit that favorite instead, or delete it first.</p>
      <H2 id="locations-row">A Locations row will not take an icon</H2>
      <p>Finder&rsquo;s synthesised entries (iCloud Drive, Computer, AirDrop, Network and the cloud-provider rows) cannot take a custom icon at all. macOS stores one and never draws it, so the app leaves them alone. A mounted disk or share can: see <DocLink to="disks-and-shares">Disks and network shares</DocLink>.</p>
      <H2 id="svg-warnings">My SVG shows warnings or looks wrong</H2>
      <p>Warnings are not rejections. The app tells you what it had to drop or flatten: embedded photos and PNGs, live text that was never outlined, colours and gradients, and artwork too fine, too dense or too wide to read at sidebar size. If a mark looks too heavy or too light, use the size slider (50 to 150 percent). If text is dropped, outline it in your vector editor and import again.</p>
      <Callout>Sidebar icons are always monochrome. A coloured SVG is flattened to one silhouette because Finder tints it to match the sidebar.</Callout>
      <H2 id="helper-status">A helper shows as not enabled</H2>
      <p>Each Both-icons favorite runs one helper. Settings shows whether each one is actually enabled, with buttons to open the extensions pane and refresh the status. In System Settings it appears under <strong>General › Login Items &amp; Extensions</strong> as <code>SBF-&lt;favorite name&gt;</code>. If a helper is disabled, the row falls back to the normal sidebar icon immediately.</p>
      <H2 id="after-uninstall">Helpers remain after uninstalling</H2>
      <p>Dragging the app to the Trash runs none of its code, so Both-icons helpers stay registered. Remove them in System Settings, or delete <code>~/Library/Application Support/SidebarFavorites</code>. Next time, delete your favorites first. See <DocLink to="uninstalling">Uninstalling</DocLink>.</p>
      <p>Still stuck? <DocLink to="report-an-issue">Report an issue</DocLink>.</p>
    </>
  );
}
