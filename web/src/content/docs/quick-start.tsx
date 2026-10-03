import type { DocMeta } from "./types";
import { Steps, Step } from "@/components/docs/Steps";
import Figure from "@/components/docs/Figure";
import CodeBlock from "@/components/docs/CodeBlock";
import Callout from "@/components/docs/Callout";
import { H2 } from "@/components/docs/Headings";
import { BREW_LINES } from "@/lib/config";

export const meta: DocMeta = {
  slug: "quick-start",
  title: "Quick start",
  group: "Getting started",
  description: "Add your first favorite in under a minute. You need macOS 13 or later and the app from the Install page.",
  keywords: ["first favorite", "add", "folder", "sf symbol", "getting started", "tutorial", "new favorite", "cmd n"],
  excerpt: "Click +, pick the folder, choose an SF Symbol or import an SVG, then Add. The folder appears in Finder's sidebar with your icon.",
  sections: [
    { id: "click", title: "Click +" },
    { id: "pick-the-folder", title: "Pick the folder" },
    { id: "choose-the-icon", title: "Choose the icon" },
    { id: "add", title: "Add" },
    { id: "homebrew", title: "Install with Homebrew" },
    { id: "monochrome", title: "Monochrome icons" },
  ],
};

export function Body() {
  return (
    <>
      <Steps>
        <Step id="click" title="Click + (or press ⌘N)">The favorite editor opens in its own window. Move it, resize it, leave it open beside the list.</Step>
        <Step id="pick-the-folder" title="Pick the folder">Browse, or type a path (<code>~</code> works). The name follows the folder: Finder always labels a favorite with its folder&rsquo;s real name.</Step>
        <Step id="choose-the-icon" title="Choose the icon">Type an SF Symbol name like <code>hammer.fill</code>, click a quick pick, or <strong>Browse All…</strong> to search about 8,300 symbols by name or keyword. Or <strong>Import SVG…</strong> to use your own artwork.</Step>
        <Step id="add" title="Add">The folder appears in Finder&rsquo;s sidebar with your icon. If Finder still shows the old one, use the <strong>Restart Finder</strong> banner.</Step>
      </Steps>
      <Figure shot="SBFAddFavoriteWindow" alt="The favorite editor window with the SF Symbol type selected, the symbol name folder.fill and a grid of quick-pick symbols" caption="The favorite editor with an SF Symbol chosen." max={832} crop={832 / 380} focus={50} />
      <H2 id="homebrew" hidden>Install with Homebrew</H2>
      <CodeBlock code={BREW_LINES.join("\n")} prompt label="Homebrew install commands" />
      <Callout id="monochrome">Sidebar icons are always monochrome: Finder draws a flat silhouette tinted to match the sidebar. The preview shows exactly that silhouette.</Callout>
    </>
  );
}
