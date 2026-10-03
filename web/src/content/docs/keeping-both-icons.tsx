import type { DocMeta } from "./types";
import Figure from "@/components/docs/Figure";
import Callout from "@/components/docs/Callout";
import { H2, H3 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "keeping-both-icons",
  title: "Keeping both icons",
  group: "Guides",
  description: "Folders with an icon of their own can keep it and a sidebar glyph. Three choices, one opt-in mode, and one small helper per favorite.",
  keywords: ["both icons", "own icon", "get info", "dock", "macos 26", "tahoe", "finder sync", "helper", "login items", "extensions", "remove its icon", "leave as is", "refresh", "advanced"],
  excerpt: "On macOS 26 a folder's own icon fights the sidebar and the glyph disappears. Keep both icons, remove its icon, or leave it as is.",
  sections: [
    { id: "the-problem", title: "The problem" },
    { id: "three-choices", title: "The three choices" },
    { id: "both-icons-mode", title: "Both icons mode" },
    { id: "helpers", title: "Helpers and their status" },
    { id: "changing-your-mind", title: "Changing your mind" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="the-problem">The problem</H2>
      <p>Some folders already have <strong>an icon of their own</strong>, the kind you paste into Get Info, usually so the folder is recognisable in the Dock.</p>
      <Callout kind="warn" title="A macOS 26 rule.">That icon fights the sidebar: Finder redraws the row from the folder&rsquo;s own icon whenever the folder changes, and the sidebar glyph disappears.</Callout>
      <H2 id="three-choices">The three choices</H2>
      <p>When you add such a folder, the app says so and offers three ways out.</p>
      <Figure shot="SBFAddFavoriteWithExistingIcon" alt="The editor warning that the folder has its own icon, with three radio choices" caption="The choice offered for a folder with its own icon." max={504} />
      <ul>
        <li><strong>Keep both icons.</strong> The folder keeps its icon everywhere (Desktop, Finder windows, the Dock) and the row keeps your glyph. Switches this favorite to <strong>Both icons</strong> mode, which adds one small Finder Sync helper for it.</li>
        <li><strong>Remove its icon.</strong> The folder goes back to a plain icon, which is enough to make the glyph stick. Nothing is deleted until you press Save or Apply, and a copy is kept in <code>~/Library/Application Support/SidebarFavorites/IconBackups/</code>.</li>
        <li><strong>Leave as is.</strong> Change nothing, and accept that the glyph disappears whenever the folder changes, until you press <strong>Refresh</strong>.</li>
      </ul>
      <p>It is a choice you can change. None of the three does anything until you save, so you can move between them freely, and Cancel leaves the folder untouched. Folders without an icon of their own are added exactly as before, with no extra questions.</p>
      <H2 id="both-icons-mode">Both icons mode</H2>
      <p>Pick <strong>Keep both icons</strong> and the warning turns into confirmation: Mode switches to <em>Both icons</em>, and the line underneath names the helper it will add.</p>
      <Figure shot="SBFAddFavoriteAdvancedSuccess" alt="The editor with Both icons selected and the helper named underneath" caption="Both icons selected." max={480} />
      <p>The result: the folder keeps its own icon in Finder windows and the Dock, while its sidebar row shows your glyph. SF Symbols and custom SVGs work the same in both modes. For the mechanism behind it, see <DocLink to="how-it-works" hash="both-icons">How it works</DocLink>.</p>
      <H2 id="helpers">Helpers and their status</H2>
      <p>Each Both-icons favorite runs one helper: about 6 MB, no window, nothing at login. It appears in <strong>System Settings › General › Login Items &amp; Extensions</strong> as <code>SBF-&lt;favorite name&gt;</code> with this app&rsquo;s icon, and the app&rsquo;s Settings shows whether each one is actually enabled.</p>
      <Figure shot="SBFSettings" alt="The Settings window listing each helper and whether it is enabled" caption="Helper status in Settings." max={472} />
      <H3 id="helper-removal">Removing a helper</H3>
      <p>Switching a favorite back to the normal mode removes its helper. If you remove the app itself, do it in the right order: see <DocLink to="uninstalling">Uninstalling</DocLink>.</p>
      <H2 id="changing-your-mind">Changing your mind</H2>
      <p>You can switch a favorite between modes at any time in its editor. Switching back removes the helper, and the row falls straight back to the normal sidebar icon.</p>
    </>
  );
}
