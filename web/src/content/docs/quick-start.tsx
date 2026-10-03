import type { DocMeta } from "./types";
import { Steps, Step } from "@/components/docs/Steps";
import Figure from "@/components/docs/Figure";
import Callout from "@/components/docs/Callout";
import DocLink from "@/components/docs/DocLink";
import { H2 } from "@/components/docs/Headings";

export const meta: DocMeta = {
  slug: "quick-start",
  title: "Quick start",
  group: "Getting started",
  description: "Add your first favorite: pick a folder, pick an icon, press Add. You need macOS 13 or later and the app from the Install page.",
  keywords: ["first favorite", "add", "folder", "sf symbol", "getting started", "tutorial", "new favorite", "cmd n"],
  excerpt: "Click +, pick the folder, choose an SF Symbol or import an SVG, then Add. The folder appears in Finder's sidebar with your icon. Browse All searches about 8,300 symbols.",
  sections: [
    { id: "click", title: "Click +" },
    { id: "pick-the-folder", title: "Pick the folder" },
    { id: "choose-the-icon", title: "Choose the icon" },
    { id: "add", title: "Add" },
    { id: "browse-all", title: "Browse All SF Symbols" },
    { id: "restart-finder", title: "If Finder shows an old icon" },
  ],
};

export function Body() {
  return (
    <>
      <p>Install the app first (see <DocLink to="install">Install</DocLink>), then open it. This is the manager window, where your favorites are listed.</p>
      <Figure shot="SBFMainWindow" alt="The SidebarFavorites manager window listing favorites, each with its icon" caption="The manager window. The + button adds a favorite." />
      <Steps>
        <Step id="click" title="Click + (or press ⌘N)">The favorite editor opens.</Step>
        <Step id="pick-the-folder" title="Pick the folder">Browse, or type a path (<code>~</code> works). The name follows the folder, because Finder always labels a favorite with its folder&rsquo;s real name.</Step>
        <Step id="choose-the-icon" title="Choose the icon">For an <strong>SF Symbol</strong>, type a name like <code>hammer.fill</code> or <code>star.circle</code>, or click one of the quick picks. For a <strong>Custom SVG</strong>, click <em>Import SVG…</em> and pick any SVG file.</Step>
        <Step id="add" title="Add">The folder appears in Finder&rsquo;s sidebar with your icon.</Step>
      </Steps>
      <p>The editor is its own window. Move it, resize it, leave it open beside the list.</p>
      <Figure shot="SBFAddFavoriteWindow" alt="The favorite editor window with a folder chosen, the SF Symbol type selected and a grid of quick-pick symbols" caption="Adding a favorite: the folder, the icon type and the quick-pick symbols in one window." />
      <H2 id="browse-all">Browse All SF Symbols</H2>
      <p><strong>Browse All…</strong> searches every SF Symbol this Mac can draw, about 8,300 of them, by name or by keyword. So &ldquo;bin&rdquo; finds <code>trash</code>.</p>
      <Figure shot="SFSymbolBrowser" alt="The SF Symbols browser sheet with a search field and a grid of symbols" caption="Browsing the SF Symbols catalog by name or keyword." />
      <p>For your own artwork, see <DocLink to="custom-svg-icons">Custom SVG icons</DocLink>.</p>
      <H2 id="restart-finder">If Finder shows an old icon</H2>
      <Callout kind="warn">If Finder is still showing an old icon, a banner appears with a <strong>Restart Finder</strong> button. The app never restarts Finder on its own.</Callout>
    </>
  );
}
