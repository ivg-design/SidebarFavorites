import type { DocMeta } from "./types";
import Figure from "@/components/docs/Figure";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { MenuPath, Kbd } from "@/components/docs/Inline";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "keeping-both-icons",
  title: "Keeping both icons",
  group: "Guides",
  description: "Some folders and disks carry an icon of their own, and on macOS 26 that icon makes your sidebar glyph disappear. This page explains the problem, the three choices the editor offers, and the Both icons mode that keeps both icons. Read it if the editor shows a warning about a custom icon or a glyph keeps vanishing.",
  keywords: ["both icons", "own icon", "get info", "dock", "macos 26", "tahoe", "finder sync", "helper", "login items", "extensions", "remove its icon", "leave as is", "refresh", "advanced", "iconbackups"],
  excerpt: "On macOS 26 a folder's own icon makes the sidebar glyph disappear. Keep both icons with a small helper, remove the folder's icon, or leave it as is.",
  sections: [
    { id: "the-problem", title: "The problem" },
    { id: "three-choices", title: "The three choices" },
    { id: "choose", title: "Choose what to do" },
    { id: "both-icons-mode", title: "What Both icons mode adds" },
    { id: "helpers", title: "Check, manage and remove helpers" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="the-problem">The problem</H2>
      <p>Some folders carry an icon of their own, the kind you paste into Get Info so the folder is recognisable on the Desktop or in the Dock. Disks can carry one too. On macOS 26, Finder redraws the sidebar row from that icon whenever the folder changes, for example when a file is copied in, and your glyph disappears.</p>
      <p>The editor checks the folder you choose. If it finds an icon of its own, it shows <q>This folder has a custom icon of its own.</q> (for a disk, <q>This disk has a custom icon of its own.</q>) and offers the choices below. Folders without an icon of their own get no extra question.</p>

      <H2 id="three-choices">The three choices</H2>
      <p>The choices are three radio buttons under the warning. The line under them explains the one you picked.</p>
      <Table label="The three choices for a folder with its own icon">
        <thead><tr><th>Choice</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td><strong>Keep both icons</strong></td><td>The folder keeps its own icon on the Desktop, in Finder windows and in the Dock, and the sidebar row keeps your glyph. It switches this favorite to <strong>Both icons</strong> mode, which adds one helper.</td><td>You want the folder&rsquo;s own icon and your glyph.</td></tr>
          <tr><td><strong>Remove its icon</strong></td><td>The folder goes back to a plain icon everywhere, which makes the glyph stay. A copy of the removed icon is kept in <code>IconBackups</code> in the app&rsquo;s data folder, so you can put it back.</td><td>You do not need the folder&rsquo;s own icon and want nothing extra running.</td></tr>
          <tr><td><strong>Leave as is</strong></td><td>Changes nothing. The glyph keeps disappearing whenever the folder changes, until you press <strong>Refresh</strong> in the manager window.</td><td>You rarely change the folder and accept the occasional refresh.</td></tr>
        </tbody>
      </Table>
      <p>Nothing takes effect until you click <strong>Save</strong> (or <strong>Add</strong>, or <strong>Apply</strong>), so you can move between the choices freely, and <strong>Cancel</strong> leaves the folder untouched.</p>

      <H2 id="choose">Choose what to do</H2>
      <Steps>
        <Step title={<>Open the editor and choose the folder with <strong>Browse...</strong>, or open an existing favorite.</>} see="If the folder has an icon of its own, the warning and three radio buttons appear. Leave as is is selected.">
          <Figure shot="editor-own-icon" alt="The editor for a folder with its own icon: an orange notice that the folder has a custom icon of its own, an explanation, and three choices, Keep both icons, Remove its icon and Leave as is" caption={<>Under the orange notice, choose <strong>Keep both icons</strong>, <strong>Remove its icon</strong> or <strong>Leave as is</strong>.</>} />
        </Step>
        <Step title={<>Select <strong>Keep both icons</strong>, <strong>Remove its icon</strong> or <strong>Leave as is</strong>.</>} see={<>For <strong>Keep both icons</strong>, <strong>Mode</strong> switches to <strong>Both icons</strong>, the warning turns into <q>This folder has its own icon - kept. The helper draws the sidebar glyph.</q>, and a line names the helper that will be added.</>}>
          <Figure shot="editor-both-icons" alt="The editor with Mode set to Both icons: a line saying the folder keeps its own icon everywhere while the sidebar shows your glyph, and a line naming the helper SBF-Music" caption={<>With <strong>Both icons</strong> selected, the lines under <strong>Mode</strong> say what the folder keeps and name the helper, here <q>SBF-Music</q>.</>} />
        </Step>
        <Step title={<>Click <strong>Save</strong> (<strong>Add</strong> for a new favorite).</>} see="The choice is applied. For Remove its icon the editor shows where the copy of the icon was saved.">
          <p>With <strong>Keep both icons</strong>, the app installs the helper and may ask you to enable it in System Settings. See <a href="#helpers">Check, manage and remove helpers</a>.</p>
        </Step>
      </Steps>
      <p>You can also switch any favorite to <strong>Both icons</strong> with the <strong>Mode</strong> control in the <strong>Sidebar Icon Mode</strong> section. The other segment is <strong>Sidebar icon only</strong>, which sets the glyph and runs nothing in the background.</p>

      <H2 id="both-icons-mode">What Both icons mode adds</H2>
      <p>Finder draws a sidebar row from a different source when a Finder Sync extension claims the folder, and that source ignores the folder&rsquo;s own icon. Both icons mode uses this: it adds one small helper for each favorite you switch on, and carries your artwork inside it. Favorites in the normal mode add no helper. For the mechanism, see <DocLink to="how-it-works" hash="both-icons">How it works</DocLink>.</p>
      <Table label="Facts about the helper">
        <thead><tr><th>Property</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>What it is</td><td>A Finder Sync extension carried by a small host app with no window. One is made for each Both icons favorite.</td></tr>
          <tr><td>Size</td><td>About 6 MB.</td></tr>
          <tr><td>Name in System Settings</td><td><code>SBF-&lt;favorite name&gt;</code>, shown with this app&rsquo;s icon. For a favorite named Projects it is <code>SBF-Projects</code>.</td></tr>
          <tr><td>Where it appears</td><td><MenuPath items={["System Settings", "General", "Login Items & Extensions"]} />, in the list of extensions.</td></tr>
          <tr><td>Runs at login</td><td>It is not a login item. The host app quits itself a few seconds after registering the extension, and only the extension stays.</td></tr>
          <tr><td>Where the files are</td><td><code>~/Library/Application Support/SidebarFavorites/AdvancedApps/</code></td></tr>
          <tr><td>If it is disabled</td><td>The row falls back to the normal sidebar icon at once. It comes back when you enable the helper.</td></tr>
        </tbody>
      </Table>

      <H2 id="helpers">Check, manage and remove helpers</H2>
      <p>Settings lists every helper with its status. The list appears only when at least one favorite uses Both icons mode. The window is described in <DocLink to="settings">Settings</DocLink>.</p>
      <Steps>
        <Step title={<>Press <Kbd>⌘,</Kbd>, or choose <strong>Preferences...</strong> from the menu bar menu.</>} see={<>The Settings window opens with a <strong>Finder Sync Helpers</strong> group.</>} />
        <Step title="Read the status under each helper name." see="A coloured dot and one line of text per helper.">
          <Table label="Helper status messages">
            <thead><tr><th>Status</th><th>What it means</th><th>What to do</th></tr></thead>
            <tbody>
              <tr><td><q>Enabled - the helper draws this row&rsquo;s sidebar icon</q></td><td>The helper is registered and on. The dot is green.</td><td>Nothing.</td></tr>
              <tr><td><q>Disabled in System Settings - the regular sidebar icon is shown</q></td><td>The helper exists but is switched off. The dot is orange.</td><td>Click <strong>Fix…</strong> and switch it on.</td></tr>
              <tr><td><q>Not registered - the regular sidebar icon is shown</q></td><td>macOS has not seen the helper, or its installation failed. The dot is red.</td><td>Click <strong>Fix…</strong>, then <strong>Refresh Status</strong>. If it stays, press <strong>Refresh</strong> in the manager window.</td></tr>
              <tr><td><q>Checking…</q></td><td>The status is still being read.</td><td>Wait a moment.</td></tr>
            </tbody>
          </Table>
        </Step>
        <Step title={<>Click <strong>Open Extensions Settings</strong> to enable or disable a helper.</>} see="System Settings opens at Login Items & Extensions." />
        <Step title={<>Click <strong>Refresh Status</strong> after you change it.</>} see="The status text updates." />
      </Steps>
      <p>To switch back and remove a helper, use these steps.</p>
      <Steps>
        <Step title="Open the favorite from the manager window." />
        <Step title={<>Set <strong>Mode</strong> to <strong>Sidebar icon only</strong>.</>} see="The line under Mode reads: Sets the sidebar glyph. Nothing runs in the background." />
        <Step title={<>Click <strong>Save</strong>.</>} see="The helper is removed, and the row shows the normal sidebar icon." />
      </Steps>
      <p>If you remove the app itself, delete your favorites first so no helpers are left behind. See <DocLink to="uninstalling">Uninstalling</DocLink>.</p>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Both icons problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>The glyph still disappears.</td><td>The favorite is in <strong>Sidebar icon only</strong> mode and the folder has its own icon.</td><td>Choose <strong>Keep both icons</strong> or <strong>Remove its icon</strong>, or press <strong>Refresh</strong>.</td></tr>
          <tr><td>A warning ending <q>is installed but not enabled yet. Enable it under System Settings › General › Login Items &amp; Extensions.</q></td><td>macOS asks you to switch each helper on.</td><td>Click <strong>Open Extensions Settings</strong> in Settings and enable the helper.</td></tr>
          <tr><td>A warning ending <q>did not register with the extension system. Its row keeps the regular sidebar icon for now.</q></td><td>macOS did not accept the helper.</td><td>Click <strong>Refresh</strong> in the manager window, then check Settings.</td></tr>
          <tr><td>The sidebar shows the normal icon for a Both icons favorite.</td><td>The helper is disabled or not registered.</td><td>Read its status in Settings and follow the table above.</td></tr>
        </tbody>
      </Table>
      <p>More fixes are in <DocLink to="troubleshooting" hash="helper-status">Troubleshooting</DocLink>.</p>
    </>
  );
}
