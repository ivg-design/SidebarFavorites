import type { DocMeta } from "./types";
import Callout from "@/components/docs/Callout";
import Table from "@/components/docs/Table";
import Figure from "@/components/docs/Figure";
import { Steps, Step } from "@/components/docs/Steps";
import { MenuPath, Kbd } from "@/components/docs/Inline";
import { H2, H3 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "uninstalling",
  title: "Uninstalling",
  group: "Reference",
  description: "This page shows how to remove SidebarFavorites completely: first undo your favorites inside the app, then delete the app, then clear what it leaves behind. Read it before you drag the app to the Trash, especially if you used Both icons mode.",
  keywords: ["uninstall", "remove", "delete", "trash", "remove all sidebar icons", "helpers", "login items", "application support", "cleanup", "leftover"],
  excerpt: "Remove your favorites in the app first, then drag SidebarFavorites Manager to the Trash. Do not skip the first step if you used Both icons.",
  sections: [
    { id: "order", title: "Why the order matters" },
    { id: "steps", title: "Uninstall in order" },
    { id: "left-behind", title: "What is left behind" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="order">Why the order matters</H2>
      <Callout kind="warn" title="Remove your favorites before you delete the app.">If you used <strong>Both icons</strong> mode, dragging the app to the Trash first leaves its helpers registered in System Settings.</Callout>
      <p>Your icons live in Finder&rsquo;s sidebar and in helper files that macOS knows about, not inside the app. Only the app can take them out again, and dragging it to the Trash runs none of its code. If you trash it first, its helpers stay registered and keep appearing in System Settings until you remove them there or delete the data folder. Each one says in its description that it is safe to disable if SidebarFavorites is gone.</p>

      <H2 id="steps">Uninstall in order</H2>
      <H3 id="step-remove-favorites">Step 1: remove your favorites</H3>
      <p>Choose one of the two ways. Remove All Sidebar Icons is the shorter one and also clears the helpers.</p>
      <Table label="Ways to remove your favorites">
        <thead><tr><th>Way</th><th>What it removes</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td>Delete favorites one by one</td><td>For each favorite you delete: the sidebar row the app added, or the custom icon on a row you added yourself, and that favorite&rsquo;s Both-icons helper. The favorite leaves the list.</td><td>You have a few favorites, or you want to keep some of them until the end.</td></tr>
          <tr><td>Settings, <strong>Remove All Sidebar Icons</strong></td><td>Every row the app added, every custom icon on rows you added, the icon helper bundle and every Both-icons helper. The favorites stay in the list.</td><td>You have many favorites, or you want to be sure nothing is missed.</td></tr>
        </tbody>
      </Table>
      <H3 id="delete-one-by-one">Delete favorites one by one</H3>
      <Steps>
        <Step title="Point at a favorite in the manager window." see="A pencil button and a trash button appear on the row." />
        <Step title="Click the trash button." see={<>A dialog titled <q>Remove &ldquo;name&rdquo;?</q> opens. For a row the app added it says <q>This removes it from Finder&rsquo;s sidebar.</q> For a row you added yourself it says <q>This clears its custom icon. The row stays in Finder&rsquo;s sidebar - it was already there before this app touched it.</q></>} />
        <Step title={<>Click <strong>Remove</strong>.</>} see="The favorite leaves the list, and its sidebar row or its icon is gone from Finder." />
        <Step title="Repeat for every favorite." see="The manager window shows its empty state." />
      </Steps>
      <H3 id="remove-all-sidebar-icons">Use Remove All Sidebar Icons</H3>
      <Steps>
        <Step title={<>Open Settings: press <Kbd>⌘,</Kbd> in the app.</>} see="The Settings window opens." />
        <Step title={<>Click <strong>Remove All Sidebar Icons</strong> under <strong>Actions</strong>.</>} see={<>A dialog titled <q>Remove All Sidebar Icons?</q> counts what it will remove and ends with <q>This cannot be undone.</q></>}>
          <Figure shot="alert-remove-all" alt="The confirmation titled Remove All Sidebar Icons? listing rows removed, an icon cleared and the helper bundle deleted, with the buttons Remove All Sidebar Icons and Cancel" caption={<>Read the counts, then confirm with <strong>Remove All Sidebar Icons</strong>.</>} />
        </Step>
        <Step title={<>Click <strong>Remove All Sidebar Icons</strong> in the dialog.</>} see={<>An alert reports <q>All sidebar icons were removed.</q> The rows the app added are gone from Finder&rsquo;s sidebar.</>}>
          <p>The details of this action are on <DocLink to="settings" hash="remove-all">Settings</DocLink>.</p>
        </Step>
        <Step title="Delete the favorites from the list as well, if you want them gone from the app." see="The manager window shows its empty state." />
      </Steps>

      <H3 id="step-turn-off-login">Step 2: turn off Launch at Login</H3>
      <Steps>
        <Step title={<>In Settings, turn off <strong>Launch at Login</strong>.</>} see="The switch is off, so macOS does not start the app when you log in." />
      </Steps>

      <H3 id="step-delete-app">Step 3: quit and delete the app</H3>
      <Steps>
        <Step title={<>Choose <strong>Quit SidebarFavorites</strong> from the menu bar menu, or press <Kbd>⌘Q</Kbd>.</>} see="The app quits and its menu bar item disappears." />
        <Step title={<>Drag <strong>SidebarFavorites Manager</strong> from the Applications folder to the Trash.</>} see="The app is in the Trash." />
        <Step title={<>Empty the Trash.</>} see="The app is gone." />
      </Steps>

      <H2 id="left-behind">What is left behind</H2>
      <p>Deleting the app removes only the app. These items stay on your Mac, and each is harmless to leave. Remove them if you want no trace.</p>
      <Table label="What is left behind and how to remove it">
        <thead><tr><th>Item</th><th>Where</th><th>How to remove it</th></tr></thead>
        <tbody>
          <tr><td>The data folder: your configuration, imported SVGs, icon backups, the helper bundle, the Both-icons helpers, and the spacer files and spacer helper in <code>Spacers.noindex</code>.</td><td><code>~/Library/Application Support/SidebarFavorites</code></td><td>In Finder, choose <MenuPath items={["Go", "Go to Folder…"]} />, paste the path, press Return, then move the folder to the Trash. See <DocLink to="config-json" hash="location">config.json</DocLink> for its contents.</td></tr>
          <tr><td>Both-icons helpers still listed in System Settings, named <q>SBF-</q> followed by a favorite&rsquo;s name.</td><td><MenuPath items={["System Settings", "General", "Login Items & Extensions"]} /></td><td>Delete the data folder above, or switch each helper off in that pane. Switching it off is enough, because a disabled helper does nothing.</td></tr>
          <tr><td>A login item for the app, if you left <strong>Launch at Login</strong> on.</td><td><MenuPath items={["System Settings", "General", "Login Items & Extensions"]} /></td><td>Turn it off in that pane.</td></tr>
        </tbody>
      </Table>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Uninstalling problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>Helpers named <q>SBF-…</q> are still listed in System Settings after the app is gone.</td><td>The app was trashed before its favorites were removed, so nothing unregistered the helpers.</td><td>Delete <code>~/Library/Application Support/SidebarFavorites</code>, or switch each helper off in System Settings. See <DocLink to="troubleshooting" hash="after-uninstall">Troubleshooting</DocLink>.</td></tr>
          <tr><td>A sidebar row still shows its icon after you removed everything.</td><td>Finder has not redrawn the row.</td><td>Restart Finder from Settings. This closes Finder windows, so finish any copy first.</td></tr>
          <tr><td>The alert reports <q>Some sidebar icons could not be fully removed</q>.</td><td>One part of the removal failed.</td><td>Read the lines in the alert, fix what they name, and run <strong>Remove All Sidebar Icons</strong> again.</td></tr>
        </tbody>
      </Table>
    </>
  );
}
