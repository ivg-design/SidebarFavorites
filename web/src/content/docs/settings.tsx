import type { DocMeta } from "./types";
import Figure from "@/components/docs/Figure";
import Table from "@/components/docs/Table";
import Callout from "@/components/docs/Callout";
import { Steps, Step } from "@/components/docs/Steps";
import { Kbd, MenuPath } from "@/components/docs/Inline";
import { H2, H3 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "settings",
  title: "Settings",
  group: "Reference",
  description: "This page describes every control in the SidebarFavorites Settings window, in the order the window shows them: what it does, its default, and when to use it. Read it when you want the app to start at login, hide its menu bar item, check a helper, restart Finder, remove all icons, or copy a report for an issue.",
  keywords: ["settings", "preferences", "launch at login", "show in menu bar", "restart finder", "remove all sidebar icons", "copy diagnostics", "diagnostics", "finder sync helpers", "helper app", "reveal backup", "configuration issue"],
  excerpt: "Launch at Login, Show in Menu Bar, the About section, the Finder Sync Helpers list, Restart Finder, Remove All Sidebar Icons and Copy Diagnostics.",
  sections: [
    { id: "open", title: "Open Settings" },
    { id: "general", title: "General" },
    { id: "about", title: "About" },
    { id: "finder-sync-helpers", title: "Finder Sync Helpers" },
    { id: "actions", title: "Actions" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="open">Open Settings</H2>
      <p>Settings is a small window with four groups. The manager window has no button for it, so you open it from a menu or with a shortcut.</p>
      <Steps>
        <Step title={<>Press <Kbd>⌘,</Kbd> while SidebarFavorites is in front, or choose <strong>Preferences...</strong> from the menu bar menu.</>} see="The Settings window opens. Its title bar reads SidebarFavorites Manager Settings.">
          <p>The same shortcut is shown next to <strong>Preferences...</strong> in the menu bar menu. You can also use the Settings item in the app&rsquo;s own menu.</p>
        </Step>
        <Step title={<>Press <Kbd>Esc</Kbd> to close the window.</>} see="The window closes. Changes you made are already saved." />
      </Steps>
      <Figure shot="settings" alt="The Settings window: the Launch at Login and Show in Menu Bar switches, an About group with the app name, MIT License, Version and Helper App, and an Actions group with Restart Finder and Remove All Sidebar Icons" caption={<>From top to bottom: the two switches, <strong>About</strong> and <strong>Actions</strong>. A fourth group, <strong>Finder Sync Helpers</strong>, appears between them when a favorite uses Both icons.</>} />

      <H2 id="general">General</H2>
      <p>The first group, with no title, holds two switches. Both save as soon as you change them.</p>
      <Table label="General settings">
        <thead><tr><th>Setting</th><th>What it does</th><th>Default</th><th>When to use it</th></tr></thead>
        <tbody>
          <tr><td><strong>Launch at Login</strong></td><td>Starts SidebarFavorites when you log in to your Mac.</td><td>Off.</td><td>You want the menu bar item available without opening the app yourself. Your icons do not need it.</td></tr>
          <tr><td><strong>Show in Menu Bar</strong></td><td>Shows or hides the SidebarFavorites item in the menu bar. See <DocLink to="menu-bar-popover">The menu bar menu</DocLink>.</td><td>On.</td><td>You do not want a menu bar item. Hiding it does not quit the app or touch your icons.</td></tr>
        </tbody>
      </Table>
      <p>macOS owns the login item, so the app reads the real state each time you open Settings or switch back to the app. If you change it in System Settings, the switch follows. If macOS needs your approval, a line under the switch says so:</p>
      <Table label="Launch at Login messages">
        <thead><tr><th>Message under the switch</th><th>Meaning</th><th>What to do</th></tr></thead>
        <tbody>
          <tr><td><q>Waiting for approval in System Settings → Login Items</q></td><td>The switch is on, but macOS has not yet let the app start at login.</td><td>Open <MenuPath items={["System Settings", "General", "Login Items & Extensions"]} /> and allow SidebarFavorites.</td></tr>
          <tr><td>No message.</td><td>The login item is enabled, or off.</td><td>Nothing.</td></tr>
        </tbody>
      </Table>

      <H2 id="about">About</H2>
      <p>This group identifies the build and the files the app uses. Only the last two rows are links you can act on.</p>
      <Table label="About group">
        <thead><tr><th>Control</th><th>What it does</th><th>Default</th><th>When to use it</th></tr></thead>
        <tbody>
          <tr><td>App icon, <strong>SidebarFavorites</strong> and <strong>by IVG-Design</strong></td><td>Names the app and its author. It is not a control.</td><td>Always shown.</td><td>Nothing to do.</td></tr>
          <tr><td><strong>MIT License</strong></td><td>Opens the project&rsquo;s license on GitHub in your browser.</td><td>Always shown.</td><td>You want to read the terms the app is shared under.</td></tr>
          <tr><td><strong>Version</strong></td><td>Shows the version with its build number in brackets.</td><td>Always shown.</td><td>You report a problem. Quote this value so the build is exact.</td></tr>
          <tr><td><strong>Helper App</strong></td><td>Shows the path of the helper bundle that carries your icons. Clicking it reveals the bundle in Finder.</td><td>Always shown.</td><td>You want to see the bundle. Leave it alone; see <DocLink to="how-it-works" hash="helper-bundle">How it works</DocLink>.</td></tr>
          <tr><td><strong>Configuration Issue</strong></td><td>Appears only when the app could not read <code>config.json</code>. It gives the reason, and a <strong>Reveal Backup</strong> button shows the file the app moved aside in Finder.</td><td>Hidden.</td><td>You see it. Recover your favorites as described in <DocLink to="config-json" hash="if-unreadable">If the file cannot be read</DocLink>.</td></tr>
        </tbody>
      </Table>

      <H2 id="finder-sync-helpers">Finder Sync Helpers</H2>
      <p>This group is shown only while at least one favorite uses <strong>Both icons</strong> mode, because those favorites each run one small helper (about 6 MB) that macOS lists in System Settings as <q>SBF-</q> followed by the favorite&rsquo;s name. The window grows by one row for each such favorite. See <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>
      <H3 id="helper-rows">The helper rows</H3>
      <Figure shot="settings-helpers" alt="The Settings window with a Finder Sync Helpers group: one row, SBF-Music, with a green dot and an Enabled status line, then the Open Extensions Settings and Refresh Status buttons" caption={<>One helper, <q>SBF-Music</q>, with a green dot: it is enabled.</>} />
      <p>Each row shows a coloured dot, the helper&rsquo;s name, and one line saying what macOS reports for it. The app asks macOS directly, so the status is not a guess.</p>
      <Table label="Helper status values">
        <thead><tr><th>Dot and status line</th><th>What it means</th><th>Button on the row</th></tr></thead>
        <tbody>
          <tr><td>Green: <q>Enabled — the helper draws this row&rsquo;s sidebar icon</q></td><td>The helper is registered and switched on. Both icons work.</td><td>None.</td></tr>
          <tr><td>Orange: <q>Disabled in System Settings — the regular sidebar icon is shown</q></td><td>The helper exists but is switched off. The row shows the normal sidebar icon only.</td><td><strong>Fix…</strong></td></tr>
          <tr><td>Red: <q>Not registered — the regular sidebar icon is shown</q></td><td>macOS has not seen the helper, because it is not installed yet or the install failed. The row shows the normal sidebar icon only.</td><td><strong>Fix…</strong></td></tr>
          <tr><td>Grey: <q>Checking…</q></td><td>The status has not been read yet.</td><td>None.</td></tr>
        </tbody>
      </Table>
      <Figure shot="settings-helper-not-registered" alt="The same Settings window with the SBF-Music row showing a red dot, the status Not registered and a Fix button at the right" caption={<>A red dot and <q>Not registered</q>: the row gets a <strong>Fix…</strong> button at its right.</>} />
      <H3 id="helper-buttons">The buttons</H3>
      <Table label="Finder Sync Helpers buttons">
        <thead><tr><th>Button</th><th>What it does</th><th>When to use it</th></tr></thead>
        <tbody>
          <tr><td><strong>Fix…</strong></td><td>Opens the System Settings pane that lists the helpers. It appears on a row only when the helper is disabled or not registered.</td><td>A row is orange or red. Switch the helper on in that pane.</td></tr>
          <tr><td><strong>Open Extensions Settings</strong></td><td>Opens the same System Settings pane, <MenuPath items={["System Settings", "General", "Login Items & Extensions"]} />.</td><td>You want to see or change the helpers yourself.</td></tr>
          <tr><td><strong>Refresh Status</strong></td><td>Asks macOS for every helper&rsquo;s status again.</td><td>You changed a helper in System Settings and want the rows to update.</td></tr>
        </tbody>
      </Table>

      <H2 id="actions">Actions</H2>
      <p>These three buttons act on Finder and on your sidebar. None of them asks you to choose a favorite.</p>
      <H3 id="restart-finder">Restart Finder</H3>
      <p>Quits Finder, which macOS then starts again, so that Finder redraws sidebar rows whose icon changed. The app never does this by itself, and it asks no confirmation here because you pressed the button on purpose. The manager window shows a banner with the same button when a restart is owed, and the editor&rsquo;s <strong>Apply</strong> button restarts Finder as well.</p>
      <Table label="Restart Finder">
        <thead><tr><th>Control</th><th>What it does</th><th>When to use it</th></tr></thead>
        <tbody>
          <tr><td><strong>Restart Finder</strong></td><td>Closes every Finder window and tab, and loses their sort order and any unfinished rename. A copy in progress is aborted and left partly written.</td><td>Finder still shows an old icon after you changed a favorite, and no copy or rename is running.</td></tr>
        </tbody>
      </Table>
      <H3 id="remove-all">Remove All Sidebar Icons</H3>
      <p>Undoes every favorite&rsquo;s effect on Finder in one step. Use it before you uninstall the app, or when you want a clean sidebar. It asks you to confirm first.</p>
      <Table label="Remove All Sidebar Icons">
        <thead><tr><th>What is removed</th><th>Details</th></tr></thead>
        <tbody>
          <tr><td>Rows the app added.</td><td>Each row is deleted from Finder&rsquo;s sidebar, not moved to the Trash.</td></tr>
          <tr><td>Icons on rows you added yourself.</td><td>The custom icon is cleared. The row stays in Finder.</td></tr>
          <tr><td>The icon helper bundle.</td><td>The bundle named in the <strong>Helper App</strong> row is deleted.</td></tr>
          <tr><td>Every Both-icons helper.</td><td>The helpers are removed from System Settings, and the favorites that used them are switched to <strong>Sidebar icon only</strong>.</td></tr>
        </tbody>
      </Table>
      <p>The confirmation is a dialog titled <q>Remove All Sidebar Icons?</q> with a <strong>Remove All Sidebar Icons</strong> button and a <strong>Cancel</strong> button. Its message counts what will happen, with one line for each part that applies:</p>
      <Figure shot="alert-remove-all" alt="The confirmation titled Remove All Sidebar Icons? with four lines: rows removed, a custom icon cleared, the icon helper bundle deleted, and This cannot be undone, above the buttons Remove All Sidebar Icons and Cancel" caption={<>The dialog counts the rows it will remove and the icons it will clear before you confirm.</>} />
      <Table label="Lines in the confirmation dialog">
        <thead><tr><th>Line in the dialog</th><th>It appears when</th></tr></thead>
        <tbody>
          <tr><td><q>Removes 5 rows this app added to Finder&rsquo;s sidebar.</q></td><td>The app added at least one row. The number is your own count.</td></tr>
          <tr><td><q>Clears the custom icon on 1 row you added yourself; the row stays in Finder.</q></td><td>At least one favorite sits on a row that was already in your sidebar.</td></tr>
          <tr><td><q>Deletes the icon helper bundle.</q></td><td>Always.</td></tr>
          <tr><td><q>This cannot be undone.</q></td><td>Always.</td></tr>
        </tbody>
      </Table>
      <Callout kind="warn">The action cannot be undone. Your favorites stay in the manager window&rsquo;s list, but their rows and icons are removed from Finder.</Callout>
      <p>When the work is done, an alert titled <q>Remove All Sidebar Icons</q> reports <q>All sidebar icons were removed.</q> or, if something failed, <q>Some sidebar icons could not be fully removed:</q> followed by one line per problem. Finder may still show an old icon on a row you added yourself until it restarts; the manager window then offers <strong>Restart Finder</strong>.</p>
      <p>The favorites themselves stay in the manager window&rsquo;s list. Delete them there as well if you want them gone for good. To remove the app altogether, follow <DocLink to="uninstalling">Uninstalling</DocLink>.</p>

      <H3 id="copy-diagnostics">Copy Diagnostics</H3>
      <p>Copies a plain-text report of your favorites and of Finder&rsquo;s sidebar rows to the clipboard, for pasting into a GitHub issue. It only reads: it changes no favorite and no sidebar row. For each favorite the report lists its settings and whether its folder exists. For each row under Favorites in Finder&rsquo;s sidebar it lists the icon code, where the row points and which symbol that code resolves to. The report contains your folder paths, so read it before you post it.</p>
      <Table label="Copy Diagnostics">
        <thead><tr><th>Control</th><th>What it does</th><th>When to use it</th></tr></thead>
        <tbody>
          <tr><td><strong>Copy Diagnostics</strong></td><td>Copies the report. The label changes to <strong>Diagnostics Copied</strong> for two seconds.</td><td>You are reporting a problem. See <DocLink to="report-an-issue">Report an issue</DocLink>.</td></tr>
        </tbody>
      </Table>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Settings problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>A helper row is orange or red.</td><td>The helper is switched off in System Settings, or macOS has not registered it.</td><td>Click <strong>Fix…</strong>, switch the helper on, then click <strong>Refresh Status</strong>. See <DocLink to="troubleshooting" hash="helper-status">Troubleshooting</DocLink>.</td></tr>
          <tr><td>An alert titled <q>Couldn&rsquo;t Save Settings</q>, or one that begins <q>Couldn&rsquo;t change Launch at Login</q>.</td><td>The app could not write the setting, or macOS refused the login item.</td><td>Try the switch again. If it keeps failing, check the login item in System Settings.</td></tr>
          <tr><td>A <strong>Configuration Issue</strong> notice in <strong>About</strong>.</td><td>The configuration file could not be read.</td><td>Click <strong>Reveal Backup</strong> and recover the file. See <DocLink to="config-json" hash="if-unreadable">If the file cannot be read</DocLink>.</td></tr>
          <tr><td><strong>Remove All Sidebar Icons</strong> reports <q>Some sidebar icons could not be fully removed</q>.</td><td>One part of the removal failed, and the alert names it.</td><td>Read each line, fix what it names, and run the action again. See <DocLink to="troubleshooting">Troubleshooting</DocLink>.</td></tr>
        </tbody>
      </Table>
    </>
  );
}
