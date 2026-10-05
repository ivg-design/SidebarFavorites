import type { DocMeta } from "./types";
import Figure from "@/components/docs/Figure";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { Kbd } from "@/components/docs/Inline";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "menu-bar-popover",
  title: "The menu bar menu",
  group: "Guides",
  description: "This page describes the SidebarFavorites menu in the macOS menu bar: what each item does, and how to switch the menu bar item off and on again. Read it if you want to reach your folders without opening the app, or if you want the menu bar item gone.",
  keywords: ["menu bar", "popover", "menu", "status item", "refresh all", "preferences", "quit", "open", "show in menu bar", "hide"],
  excerpt: "Click the SidebarFavorites item in the menu bar to list your favorites; choosing one reveals its folder in Finder. The menu also has Open SidebarFavorites..., Refresh All, Preferences... and Quit.",
  sections: [
    { id: "what-it-is-for", title: "What the menu is for" },
    { id: "the-menu", title: "The menu items" },
    { id: "turning-it-off", title: "Turn the menu bar item off and on" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="what-it-is-for">What the menu is for</H2>
      <p>The app keeps a small sidebar icon in the menu bar. Clicking it opens a menu that lists every favorite with its icon. Choosing a favorite opens its folder in Finder, so you can reach it from any app without opening the manager window. The menu is a standard macOS menu, not a floating panel, so it closes as soon as you choose an item or click elsewhere.</p>
      <Figure shot="menu-bar-menu" alt="The menu bar menu: seven favorites with their icons, then Open SidebarFavorites, Refresh All and Preferences with their shortcuts, then the version line and Quit SidebarFavorites" caption={<>Your favorites at the top, then <strong>Open SidebarFavorites...</strong>, <strong>Refresh All</strong> and <strong>Preferences...</strong>, and at the bottom the version and <strong>Quit SidebarFavorites</strong>.</>} />

      <H2 id="the-menu">The menu items</H2>
      <p>The menu has these items, from top to bottom. The shortcuts work while the menu is open.</p>
      <Table label="Items in the menu bar menu">
        <thead><tr><th>Item</th><th>Shortcut</th><th>What it does</th></tr></thead>
        <tbody>
          <tr><td>Each favorite, by name</td><td>None</td><td>Opens the favorite&rsquo;s folder in a Finder window.</td></tr>
          <tr><td><strong>No Favorites</strong></td><td>None</td><td>Takes the place of the list when you have not added a favorite. It is dimmed and does nothing.</td></tr>
          <tr><td><strong>Open SidebarFavorites...</strong></td><td><Kbd>⌘O</Kbd></td><td>Brings the manager window to the front, and opens it if it was closed.</td></tr>
          <tr><td><strong>Refresh All</strong></td><td>None</td><td>Rebuilds the icons and the sidebar rows and registers them again. It is the same action as <strong>Refresh</strong> in the manager window.</td></tr>
          <tr><td><strong>Preferences...</strong></td><td><Kbd>⌘,</Kbd></td><td>Opens the Settings window. See <DocLink to="settings">Settings</DocLink>.</td></tr>
          <tr><td>SidebarFavorites and the version</td><td>None</td><td>Shows the version and build you are running, for example when you report a problem. It is dimmed and does nothing.</td></tr>
          <tr><td><strong>Quit SidebarFavorites</strong></td><td><Kbd>⌘Q</Kbd></td><td>Quits the app. Your icons stay in Finder&rsquo;s sidebar, because quitting only closes the app and the icons do not need it to run.</td></tr>
        </tbody>
      </Table>

      <H2 id="turning-it-off">Turn the menu bar item off and on</H2>
      <p>The menu bar item is on by default. Its switch is <strong>Show in Menu Bar</strong> in Settings, and the change takes effect at once.</p>
      <Steps>
        <Step title={<>Choose <strong>Preferences...</strong> from the menu bar menu, or press <Kbd>⌘,</Kbd>.</>} see="The Settings window opens.">
          <Figure shot="settings" alt="The Settings window: the Launch at Login and Show in Menu Bar switches, an About group with the app name, MIT License, Version and Helper App, and an Actions group with Restart Finder and Remove All Sidebar Icons" caption={<><strong>Show in Menu Bar</strong> is the second switch from the top.</>} />
        </Step>
        <Step title={<>Turn off <strong>Show in Menu Bar</strong>.</>} see="The sidebar icon disappears from the menu bar. The app keeps running, and your icons are unaffected." />
      </Steps>
      <p>To open Settings while the menu bar item is hidden, use the Settings item in the app&rsquo;s own menu in the menu bar while the manager window is in front, or press <Kbd>⌘,</Kbd>. If the app is not running, open <strong>SidebarFavorites Manager</strong> from Applications first. Then turn the switch on again:</p>
      <Steps>
        <Step title={<>Open Settings and turn on <strong>Show in Menu Bar</strong>.</>} see="The sidebar icon returns to the menu bar." />
      </Steps>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Menu bar problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>There is no SidebarFavorites item in the menu bar.</td><td>The app is not running, or <strong>Show in Menu Bar</strong> is off.</td><td>Open the app from Applications, then turn on <strong>Show in Menu Bar</strong> in Settings.</td></tr>
          <tr><td>The item is missing on a crowded menu bar.</td><td>macOS hides menu bar items that do not fit, such as under the notch.</td><td>Make room by quitting or hiding other menu bar items.</td></tr>
        </tbody>
      </Table>
    </>
  );
}
