import type { DocMeta } from "./types";
import Figure from "@/components/docs/Figure";
import Callout from "@/components/docs/Callout";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "custom-svg-icons",
  title: "Custom SVG icons",
  group: "Guides",
  description: "Import any ordinary SVG as a sidebar icon. Nothing to prepare, a live preview at the real size, and a 50 to 150 percent size slider.",
  keywords: ["svg", "import", "logo", "custom icon", "size slider", "preview", "warnings", "raster", "gradient", "actool", "xcode", "flatten"],
  excerpt: "The app parses the file, flattens it to a single outline and builds the SF Symbol around it. No SF Symbols template, no guide boxes, no Xcode.",
  sections: [
    { id: "import", title: "Import any SVG" },
    { id: "preview", title: "Live preview" },
    { id: "size", title: "Size slider" },
    { id: "apply", title: "Apply" },
    { id: "warnings", title: "What the app tells you it dropped" },
    { id: "monochrome", title: "Icons are monochrome" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="import">Import any SVG</H2>
      <p>Click <strong>Import SVG…</strong> in the editor and pick any ordinary SVG: a logo, an icon you drew, anything made of vector shapes. There is nothing to prepare. No SF Symbols template to export, no guide boxes to draw inside, no naming field to get right. The app parses the file, flattens it to a single outline and builds the SF Symbol around it.</p>
      <Figure shot="svg-import" alt="The SVG import sheet showing an enlarged silhouette and a mock sidebar row" caption="Importing an SVG." max={420} />
      <H2 id="preview">Live preview</H2>
      <p>You see the exact silhouette that will ship, both enlarged and in a mock sidebar row at the real 16 pt size.</p>
      <H2 id="size">Size slider</H2>
      <p>The slider runs from 50 to 150 percent. 100 percent is exactly the size of a system SF Symbol, which is the right measurement but not always the right look: a wide or busy mark reads heavier than a sparse one at the same size. Nudge it until it sits comfortably next to the rest of the sidebar. The preview follows as you drag.</p>
      <Figure shot="custom-svg-settings" alt="The custom SVG settings with the size slider and a sidebar row preview" caption="Tuning a custom icon." max={420} />
      <H2 id="apply">Apply</H2>
      <p><strong>Apply</strong> saves, rebuilds the icon and restarts Finder in one click without closing the sheet, so you can tune the size against the real sidebar.</p>
      <p>No Xcode is required. Custom icons are compiled by the asset-catalog engine that ships with macOS itself. (Before 1.1 this needed <code>actool</code>, which only exists inside Xcode.)</p>
      <H2 id="warnings">What the app tells you it dropped</H2>
      <p>Some things cannot be part of a sidebar symbol. The app tells you what it had to drop or flatten:</p>
      <ul>
        <li>embedded photos and PNGs (a symbol cannot contain raster);</li>
        <li>live text that was never outlined;</li>
        <li>colours and gradients;</li>
        <li>artwork too fine, too dense or too wide to read at sidebar size.</li>
      </ul>
      <p>These are warnings, not rejections. See <DocLink to="troubleshooting" hash="svg-warnings">Troubleshooting</DocLink> if an icon does not look the way you expected.</p>
      <H2 id="monochrome">Icons are monochrome</H2>
      <Callout>Sidebar icons are always monochrome. Finder draws them as a flat silhouette tinted to match the sidebar. Colour is impossible there. That is a macOS rule, not a limitation of this app. The preview shows you the silhouette, so there are no surprises.</Callout>
    </>
  );
}
