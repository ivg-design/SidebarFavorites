import type { DocMeta } from "./types";
import Figure from "@/components/docs/Figure";
import { H2 } from "@/components/docs/Headings";

export const meta: DocMeta = {
  slug: "menu-bar-popover",
  title: "The menu bar popover",
  group: "Guides",
  description: "Every favorite is one click away from the menu bar, with its icon. What the menu contains and how to switch it off.",
  keywords: ["menu bar", "popover", "status item", "refresh all", "preferences", "quit", "open", "show in menu bar"],
  excerpt: "Click a favorite in the menu bar to reveal its folder in Finder. The menu also has Open SidebarFavorites, Refresh All and Preferences.",
  sections: [
    { id: "what-it-shows", title: "What it shows" },
    { id: "the-menu", title: "The menu" },
    { id: "turning-it-off", title: "Turning it off" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="what-it-shows">What it shows</H2>
      <p>Every favorite is also one click away from the menu bar, with its icon. Clicking a favorite reveals its folder in Finder.</p>
      <Figure shot="SBFTaskbarPopOver" alt="The menu bar menu listing favorites with their icons" caption="The menu bar popover." max={292} />
      <H2 id="the-menu">The menu</H2>
      <ul>
        <li><strong>Your favorites</strong>, each with its icon (or &ldquo;No Favorites&rdquo; when the list is empty).</li>
        <li><strong>Open SidebarFavorites…</strong> (⌘O) brings the main window forward.</li>
        <li><strong>Refresh All</strong> forces the icons and sidebar rows to be rebuilt and re-registered, the same action as Refresh in the main window.</li>
        <li><strong>Preferences…</strong> (⌘,) opens Settings.</li>
        <li>The app version, and <strong>Quit SidebarFavorites</strong> (⌘Q).</li>
      </ul>
      <p>Quitting only closes the app. The icons stay.</p>
      <H2 id="turning-it-off">Turning it off</H2>
      <p>Settings has a <strong>Show in Menu Bar</strong> switch. It is on by default.</p>
    </>
  );
}
