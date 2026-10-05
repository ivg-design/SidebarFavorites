import type { DocMeta } from "./types";
import Callout from "@/components/docs/Callout";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { MenuPath } from "@/components/docs/Inline";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "troubleshooting",
  title: "Troubleshooting",
  group: "Help",
  description: "Each section below is one problem, with its cause and its fix. Find the heading or the message you see in the app, then follow the fix. If nothing here helps, the last section tells you how to report it.",
  keywords: ["problem", "fix", "restart finder", "glyph disappears", "macos 26", "duplicate", "refused", "svg warning", "helper", "login items", "refresh", "locations", "icloud drive", "not working", "wrong icon", "launch at login", "configuration issue", "folder no longer exists", "eject", "error"],
  excerpt: "Fixes for a stale icon in Finder, a glyph that disappears, a refused folder, Locations rows, SVG warnings, helper status, launch at login, a missing folder, an offline disk, a configuration issue and leftovers after uninstalling.",
  sections: [
    { id: "old-icon", title: "Finder shows a stale icon" },
    { id: "glyph-disappears", title: "The glyph disappears from a folder" },
    { id: "folder-refused", title: "The folder is refused when I add it" },
    { id: "folder-missing", title: "A warning says a folder is missing" },
    { id: "volume-offline", title: "A disk or share is not mounted" },
    { id: "locations-row", title: "A Locations row will not take an icon" },
    { id: "svg-warnings", title: "My SVG shows warnings or looks wrong" },
    { id: "helper-status", title: "A helper shows as not enabled" },
    { id: "launch-at-login", title: "Launch at Login does not turn on" },
    { id: "config-issue", title: "Settings shows a Configuration Issue" },
    { id: "sidebar-warnings", title: "The warnings banner lists a sidebar problem" },
    { id: "after-uninstall", title: "Helpers remain after uninstalling" },
  ],
};

export function Body() {
  return (
    <>
      <p>Problems are listed in the order people meet them. Warnings from the app appear in a yellow <strong>Warnings</strong> banner in the manager window. Click it to read them and click <strong>Dismiss</strong> to clear them.</p>

      <H2 id="old-icon">Finder shows a stale icon</H2>
      <p><strong>Cause.</strong> Finder has not redrawn the row yet. The manager window then shows a banner reading <q>Some icon changes need Finder to restart before they appear.</q> The app never restarts Finder on its own, because that closes your Finder windows and tabs and interrupts a copy in progress.</p>
      <Table label="Ways to restart Finder">
        <thead><tr><th>Fix</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td><strong>Restart Finder</strong> on the banner</td><td>Restarts Finder and clears the banner.</td><td>The banner is showing.</td></tr>
          <tr><td><strong>Restart Finder</strong> under <strong>Actions</strong> in Settings</td><td>Restarts Finder with no banner needed.</td><td>The icon is wrong but no banner appeared.</td></tr>
          <tr><td><strong>Apply</strong> in the favorite editor</td><td>Saves the favorite and restarts Finder while the editor stays open.</td><td>You are tuning an icon and want to see it in the real sidebar.</td></tr>
        </tbody>
      </Table>

      <H2 id="glyph-disappears">The glyph disappears from a folder</H2>
      <p><strong>Cause.</strong> On macOS 26, a folder or disk with an icon of its own makes Finder redraw the row from that icon whenever it changes. The banner then says <q>&lsquo;Name&rsquo; keeps losing its sidebar icon because the folder has a custom icon of its own. Open the favorite and choose Remove Its Icon to fix it permanently.</q></p>
      <Table label="Fixes for a disappearing glyph">
        <thead><tr><th>Fix</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td><strong>Keep both icons</strong></td><td>Switches the favorite to Both icons mode, which adds a helper.</td><td>You want the folder&rsquo;s own icon and your glyph.</td></tr>
          <tr><td><strong>Remove its icon</strong></td><td>Returns the folder to a plain icon and keeps a copy in <code>IconBackups</code>.</td><td>You do not need the folder&rsquo;s own icon.</td></tr>
          <tr><td><strong>Leave as is</strong></td><td>Changes nothing. The glyph returns when you press <strong>Refresh</strong>.</td><td>You accept the occasional refresh.</td></tr>
        </tbody>
      </Table>
      <p>All three are in the favorite editor. Details: <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>

      <H2 id="folder-refused">The folder is refused when I add it</H2>
      <p><strong>Cause.</strong> A folder can have only one favorite. The editor shows <q>&lsquo;Name&rsquo; already uses this folder.</q> and the text <q>A folder can only have one favorite - two would fight over the same sidebar row. Edit &lsquo;Name&rsquo; instead, or choose a different folder.</q> The <strong>Add</strong> button stays disabled until you do.</p>
      <Table label="Ways to resolve a duplicate folder">
        <thead><tr><th>Fix</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td>Edit the favorite that already uses the folder.</td><td>Changes the icon or mode of the existing favorite.</td><td>You wanted a different icon on this folder.</td></tr>
          <tr><td>Choose a different folder in the editor.</td><td>Clears the message and enables <strong>Add</strong>.</td><td>You picked the wrong folder.</td></tr>
          <tr><td>Remove the existing favorite first.</td><td>Frees the folder for a new favorite.</td><td>You want to start over.</td></tr>
        </tbody>
      </Table>

      <H2 id="folder-missing">A warning says a folder is missing</H2>
      <p><strong>Cause.</strong> The warning reads <q>Name: folder no longer exists at</q> followed by the path. The folder was moved, renamed or deleted, or it lives in a cloud provider or disk that is not available.</p>
      <Steps>
        <Step title="Put the folder back, or reconnect the provider or disk that holds it." />
        <Step title={<>Click <strong>Refresh</strong> in the manager window.</>} see="The warning is gone and the icon is applied." />
      </Steps>
      <p>If the folder moved for good, remove the favorite and add the new folder.</p>

      <H2 id="volume-offline">A disk or share is not mounted</H2>
      <p><strong>Cause.</strong> A favorite set to <strong>Show in Locations only</strong> needs a mounted disk or server. When it is not mounted the warning reads <q>&lsquo;Name&rsquo; is set to appear in Locations only, but Finder only lists mounted disks and servers there. Turn that option off to give it a row under Favorites.</q> A network share gives a related warning: <q>&lsquo;Name&rsquo; can&rsquo;t be shown in Locations only - Finder builds that row itself for network shares and it can&rsquo;t take a custom icon. Turn the option off to give it a row under Favorites instead.</q></p>
      <Table label="Fixes for a disk that is not mounted">
        <thead><tr><th>Fix</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td>Mount the disk, then press <strong>Refresh</strong>.</td><td>Applies the icon to Finder&rsquo;s Locations row.</td><td>The disk was ejected or is offline.</td></tr>
          <tr><td>Turn <strong>Show in Locations only</strong> off.</td><td>Gives the favorite a row under Favorites.</td><td>It is a network share.</td></tr>
        </tbody>
      </Table>
      <p>See <DocLink to="disks-and-shares">Disks and network shares</DocLink>.</p>

      <H2 id="locations-row">A Locations row will not take an icon</H2>
      <p><strong>Cause.</strong> Finder&rsquo;s own entries (iCloud Drive, Computer, AirDrop, Network and the cloud-provider rows) cannot take a custom icon. macOS stores one and never draws it, so the app leaves them alone.</p>
      <p>Add a folder inside the cloud location, or a mounted disk, instead. See <DocLink to="disks-and-shares" hash="cannot-take-icons">Rows that cannot take an icon</DocLink>.</p>

      <H2 id="svg-warnings">My SVG shows warnings or looks wrong</H2>
      <p><strong>Cause.</strong> Warnings are not refusals. The app tells you what it had to drop or flatten: embedded photos, live text, effects it cannot draw, colours and gradients, and artwork that is too wide, too tall, too thin or too dense to read at 16 pt.</p>
      <Table label="Fixes for SVG problems">
        <thead><tr><th>Fix</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td>Move the <strong>Size</strong> slider between 50% and 150%.</td><td>Scales the icon in the sidebar row.</td><td>The mark looks too heavy or too light.</td></tr>
          <tr><td>Outline text in your drawing app and import again.</td><td>Turns lettering into shapes.</td><td>Text is missing from the preview.</td></tr>
          <tr><td>Simplify the artwork and import again.</td><td>Removes detail that blurs at 16 pt.</td><td>The preview looks grey or smudged.</td></tr>
        </tbody>
      </Table>
      <Callout kind="note">Sidebar icons are always one flat colour, so a coloured SVG becomes one silhouette. The preview shows the result.</Callout>
      <p>Every message and its cause are listed in <DocLink to="custom-svg-icons" hash="warnings">Messages from the import sheet</DocLink>.</p>

      <H2 id="helper-status">A helper shows as not enabled</H2>
      <p><strong>Cause.</strong> Each Both icons favorite has a helper that you switch on in System Settings. Until it is on, the row shows the normal sidebar icon. Settings shows <q>Disabled in System Settings - the regular sidebar icon is shown</q> or <q>Not registered - the regular sidebar icon is shown</q>, and the banner may say a helper <q>is installed but not enabled yet</q>.</p>
      <Steps>
        <Step title={<>Open Settings and click <strong>Open Extensions Settings</strong>, or choose <MenuPath items={["System Settings", "General", "Login Items & Extensions"]} />.</>} see={<>The list of extensions, with <code>SBF-&lt;favorite name&gt;</code> for each helper.</>} />
        <Step title="Switch the helper on." />
        <Step title={<>Click <strong>Refresh Status</strong> in Settings.</>} see={<>The status reads <q>Enabled - the helper draws this row&rsquo;s sidebar icon</q>.</>} />
      </Steps>

      <H2 id="launch-at-login">Launch at Login does not turn on</H2>
      <p><strong>Cause.</strong> macOS owns the login item. Either it waits for your approval, shown as <q>Waiting for approval in System Settings → Login Items</q> under the switch, or it refused the change and an alert reads <q>Couldn&rsquo;t change Launch at Login:</q> followed by the reason.</p>
      <p>Open <MenuPath items={["System Settings", "General", "Login Items & Extensions"]} />, allow SidebarFavorites, then reopen Settings so the switch reads the real state.</p>

      <H2 id="config-issue">Settings shows a Configuration Issue</H2>
      <p><strong>Cause.</strong> The app could not read <code>config.json</code>. It moved the file aside and started with an empty list.</p>
      <p>Click <strong>Reveal Backup</strong> in Settings and follow <DocLink to="config-json" hash="if-unreadable">If the file cannot be read</DocLink>.</p>

      <H2 id="sidebar-warnings">The warnings banner lists a sidebar problem</H2>
      <p><strong>Cause.</strong> The app could not change a row in Finder&rsquo;s sidebar, or found a row it did not expect. The warning names the favorite.</p>
      <Table label="Common sidebar warnings">
        <thead><tr><th>Fix</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td>Click <strong>Refresh</strong> in the manager window.</td><td>Checks every favorite and its row again.</td><td>The warning begins <q>Couldn&rsquo;t add</q>, <q>Couldn&rsquo;t update</q>, <q>Couldn&rsquo;t rename</q> or <q>Couldn&rsquo;t check</q>.</td></tr>
          <tr><td>Remove one of the two favorites.</td><td>Leaves one favorite for the folder.</td><td>The warning says a favorite <q>points at the same folder as another favorite</q>.</td></tr>
          <tr><td>Nothing; the favorite still works.</td><td>The app applies only the icon and leaves the row and its name alone.</td><td>The warning says the favorite <q>is now linked to a sidebar row this app didn&rsquo;t add</q>.</td></tr>
        </tbody>
      </Table>

      <H2 id="after-uninstall">Helpers remain after uninstalling</H2>
      <p><strong>Cause.</strong> Dragging the app to the Trash runs none of its code, so Both icons helpers stay registered.</p>
      <Table label="Ways to remove leftover helpers">
        <thead><tr><th>Fix</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td>Remove them in <MenuPath items={["System Settings", "General", "Login Items & Extensions"]} />.</td><td>Switches the helpers off.</td><td>You want to keep the app&rsquo;s data folder.</td></tr>
          <tr><td>Delete <code>~/Library/Application Support/SidebarFavorites</code>.</td><td>Removes the helpers&rsquo; files and the app&rsquo;s data.</td><td>You are finished with the app.</td></tr>
        </tbody>
      </Table>
      <p>Next time, delete your favorites first. See <DocLink to="uninstalling">Uninstalling</DocLink>.</p>

      <p>Still stuck? <DocLink to="report-an-issue">Report an issue</DocLink>.</p>
    </>
  );
}
