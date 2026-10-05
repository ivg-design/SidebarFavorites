import type { DocMeta } from "./types";
import Figure from "@/components/docs/Figure";
import Callout from "@/components/docs/Callout";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { H2, H3 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "custom-svg-icons",
  title: "Custom SVG icons",
  group: "Guides",
  description: "A favorite can use your own SVG artwork instead of an SF Symbol. This page shows how to import a file, check the preview, set the size, and what each message on the import sheet means. Read it if you want a logo or a drawing in the sidebar, or if an import shows a warning or is refused.",
  keywords: ["svg", "import", "logo", "custom icon", "size slider", "preview", "warnings", "raster", "gradient", "xcode", "flatten", "monochrome", "refused"],
  excerpt: "Import any ordinary SVG with Import SVG..., check the enlarged and sidebar-size preview, set the size from 50 to 150 percent, then Apply. Every warning and refusal the import sheet can show is listed with its cause and fix.",
  sections: [
    { id: "what-it-is", title: "What a custom icon is" },
    { id: "import", title: "Import an SVG" },
    { id: "size", title: "The size slider" },
    { id: "warnings", title: "Messages from the import sheet" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="what-it-is">What a custom icon is</H2>
      <p>A custom icon is your own vector artwork, such as a logo or an icon you drew, shown on a favorite&rsquo;s sidebar row. Any ordinary SVG works. There is nothing to prepare: you do not need a template, guide boxes or a special file name. SidebarFavorites reads the shapes in the file, joins them into one outline and builds the sidebar symbol around it. Xcode is not required, because the app builds the symbol with the asset-catalog engine that ships with macOS.</p>
      <Callout kind="note">The result is always one flat silhouette. Finder draws every sidebar icon in a single colour and tints it to match the sidebar, so colours and gradients in your file are flattened. The preview shows the silhouette before you commit.</Callout>

      <H2 id="import">Import an SVG</H2>
      <p>You import in the favorite editor, the window you open with <strong>+</strong> in the manager window or by editing an existing favorite. The file is copied into the app&rsquo;s own <code>Icons</code> folder, so the original can move or change afterwards without affecting the favorite.</p>
      <Steps>
        <Step title={<>In the favorite editor, set <strong>Type</strong> to <strong>Custom SVG</strong>.</>} see={<>An <strong>Import SVG...</strong> button replaces the SF Symbol grid.</>} />
        <Step title={<>Click <strong>Import SVG...</strong> and choose an SVG file.</>} see={<>The file name appears with a <strong>Replace...</strong> button, and the <strong>Preview</strong> section shows your artwork.</>}>
          <Figure shot="svg-import" alt="The favorite editor with Type set to Custom SVG, the Import SVG... button, and the Preview section showing an enlarged placeholder and a mock sidebar row named Folder Name" caption={<>Before a file is chosen, the preview shows a placeholder. After you import, <strong>Enlarged</strong> and the mock row below it show your artwork.</>} />
        </Step>
        <Step title={<>Check the <strong>Preview</strong> section.</>} see="Two views of the same silhouette: an enlarged one, and a mock sidebar row at the real size, 16 pt tall.">
          <p>The preview is what Finder will draw. If the app had to drop or flatten something, a warning row with an orange triangle appears below the preview. See <a href="#warnings">Messages from the import sheet</a>.</p>
        </Step>
        <Step title={<>Drag the <strong>Size</strong> slider if the icon looks too heavy or too light next to the other rows.</>} see="The percentage and both previews follow the slider as you drag.">
          <Figure shot="editor-custom-svg" alt="The editor with Type set to Custom SVG: the file brand-mark.svg with a Replace button, the Size slider at 100% with Reset, an enlarged star in the Preview, a sidebar row preview and a warning with an orange triangle" caption={<>After import: the file name with <strong>Replace...</strong>, the <strong>Size</strong> slider from <strong>50%</strong> to <strong>150%</strong> with <strong>Reset</strong>, the <strong>Preview</strong>, and one warning below it.</>} />
        </Step>
        <Step title={<>Click <strong>Apply</strong> to see the icon in the real sidebar, or <strong>Add</strong> (<strong>Save</strong> for an existing favorite) to finish.</>} see="With Apply, the icon is saved, Finder restarts and the sidebar redraws while the editor stays open, so you can adjust the size against the real sidebar.">
          <p><strong>Apply</strong> is available only after you change something. With <strong>Add</strong> or <strong>Save</strong> the editor closes, and if Finder still shows a stale icon a <strong>Restart Finder</strong> banner appears in the manager window.</p>
        </Step>
      </Steps>

      <H2 id="size">The size slider</H2>
      <p>The slider appears only for a custom icon. SF Symbols are drawn by macOS from Apple&rsquo;s own outlines and have nothing to rescale. 100 percent draws your artwork at exactly the size of a system SF Symbol. That is the correct measurement but not always the right look: a wide or busy mark reads heavier than a narrow one at the same size, so you may want to move it down until it sits comfortably beside the other rows.</p>
      <Table label="The size slider">
        <thead><tr><th>Part</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td><strong>Size</strong> slider, <strong>50%</strong> to <strong>150%</strong></td><td>Scales the artwork in the sidebar row. The value is shown beside the label.</td><td>The icon looks too large or too small next to the other sidebar icons.</td></tr>
          <tr><td>100%</td><td>Draws the artwork at the size of a system SF Symbol.</td><td>You have no reason to change it. It is the starting value.</td></tr>
          <tr><td>Below 100%</td><td>Makes the icon smaller.</td><td>The icon is dense, wide or heavy.</td></tr>
          <tr><td>Above 100%</td><td>Makes the icon larger.</td><td>The icon is thin or sparse and looks small.</td></tr>
          <tr><td><strong>Reset</strong></td><td>Puts the slider back to 100%. It is disabled when the slider is already there.</td><td>You want to start the size over.</td></tr>
        </tbody>
      </Table>

      <H2 id="warnings">Messages from the import sheet</H2>
      <p>The import sheet reports two kinds of message. A warning means the file was imported but something was dropped or will look different. A refusal means nothing could be imported.</p>

      <H3 id="import-warnings">Warnings</H3>
      <p>Each warning is a row with an orange triangle below the preview. The icon is still imported, and the preview shows exactly what survived.</p>
      <Table label="Warnings on the import sheet">
        <thead><tr><th>Message</th><th>What it means</th><th>What to do</th></tr></thead>
        <tbody>
          <tr><td><q>The embedded image was dropped - a sidebar icon can&rsquo;t contain a photo or a PNG, only vector shapes.</q></td><td>The SVG contains a bitmap picture. Only vector shapes become part of the icon.</td><td>Replace the picture with vector artwork, or trace it in your drawing app, and import again.</td></tr>
          <tr><td><q>Live text isn&rsquo;t converted to shapes. If lettering is missing from the preview, outline it in your drawing app and import again.</q></td><td>The file contains text that is still editable text, not shapes.</td><td>Convert the text to outlines in your drawing app, export the SVG again and import it.</td></tr>
          <tr><td><q>Some parts of this SVG can&rsquo;t be reproduced in a symbol (&lt;filter&gt;). The preview shows what the icon will actually contain.</q></td><td>The SVG uses elements the app cannot turn into shapes. The message names them in angle brackets, so <code>&lt;filter&gt;</code> here stands for whichever elements your file has.</td><td>Look at the preview. If the icon is what you want, continue. If not, remove the effect or flatten it into plain shapes and import again.</td></tr>
          <tr><td><q>Colours and gradients flatten into one silhouette, so lighter areas won&rsquo;t stay lighter.</q></td><td>The file uses a gradient or more than one colour. Finder draws one colour, so every filled area becomes the same tint.</td><td>If parts merge into a blob, simplify the artwork so the shape reads without colour.</td></tr>
          <tr><td><q>Much wider than it is tall. Sidebar icons are square, so this gets shrunk to fit its width - a compact mark works better than a wordmark.</q></td><td>The artwork is more than three times wider than it is tall, so it is scaled down to fit the width.</td><td>Use a compact mark instead of a wordmark, or crop the artwork closer.</td></tr>
          <tr><td><q>Much taller than it is wide. Sidebar icons are square, so this gets shrunk to fit its height - a compact mark reads better.</q></td><td>The artwork is more than three times taller than it is wide, so it is scaled down to fit the height.</td><td>Use a squarer mark, or crop the artwork closer.</td></tr>
          <tr><td><q>Almost nothing survives at 16 pt - the artwork is very thin, very small, or floating on a much bigger canvas. Thicker shapes or a tighter crop read better.</q></td><td>At sidebar size the artwork covers under 4 percent of its box, so it is nearly invisible.</td><td>Thicken the shapes, or set the artwork&rsquo;s canvas close to its edges, then import again.</td></tr>
          <tr><td><q>This fills its box almost completely, so it will read as a solid block rather than as an icon.</q></td><td>The artwork covers more than about 72 percent of its box, so it looks like a filled square.</td><td>Add space inside the shape, or use a version with detail or an outline.</td></tr>
          <tr><td><q>Thin strokes and fine detail blur into grey at 16 pt. A bolder, simpler shape reads better.</q></td><td>Almost all of the artwork falls on partly lit pixels at 16 pt, so it looks smudged.</td><td>Use thicker strokes and fewer details, then import again.</td></tr>
        </tbody>
      </Table>

      <H3 id="import-refusals">Refusals</H3>
      <p>A refusal opens an alert titled <strong>Can&rsquo;t Use This SVG</strong>. The alert shows the message below, followed by a sentence that says what to try. Nothing is imported, and the favorite is unchanged.</p>
      <Table label="Refusals on the import sheet">
        <thead><tr><th>Message</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td><q>Couldn&rsquo;t read this file.</q></td><td>The file is empty, was moved, or you do not have permission to open it.</td><td>Check that the file exists and that you can open it, then choose it again.</td></tr>
          <tr><td><q>This isn&rsquo;t an SVG file.</q></td><td>The file is not an SVG. If it is XML with another root element, the alert says which one.</td><td>Export the artwork again as SVG from your drawing app.</td></tr>
          <tr><td><q>Couldn&rsquo;t read this SVG.</q></td><td>The file is not well-formed XML. The alert adds a detail from the XML reader when there is one.</td><td>Export the SVG again from your drawing app.</td></tr>
          <tr><td><q>This SVG just wraps an image.</q></td><td>The SVG contains only an embedded photo or PNG and no vector shapes.</td><td>Export the artwork as paths, or trace the picture first.</td></tr>
          <tr><td><q>This SVG has no shapes we can use.</q></td><td>The file has none of the shapes the app can draw: paths, rectangles, circles and the like.</td><td>Draw or export the artwork as vector shapes.</td></tr>
          <tr><td><q>We couldn&rsquo;t turn this SVG into a shape.</q></td><td>The shapes in the file come out empty. Live text and stroke-only artwork, such as a single line, are the usual cause.</td><td>Convert text and strokes to outlines in your drawing app and import again.</td></tr>
        </tbody>
      </Table>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Custom SVG problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>The alert <strong>Can&rsquo;t Use This SVG</strong>.</td><td>The file was refused.</td><td>Find the message in the refusals table above.</td></tr>
          <tr><td>A warning row with an orange triangle under the preview.</td><td>Part of the artwork was dropped or flattened.</td><td>Find the message in the warnings table above, then adjust the artwork or the size.</td></tr>
          <tr><td>The sidebar shows a stale icon.</td><td>Finder has not redrawn the row yet.</td><td>Click <strong>Apply</strong>, or press <strong>Restart Finder</strong> on the banner in the manager window.</td></tr>
          <tr><td>The icon looks too large, too small or too heavy.</td><td>100 percent matches SF Symbols, which is not always the best look for your artwork.</td><td>Change the <strong>Size</strong> slider and click <strong>Apply</strong>.</td></tr>
        </tbody>
      </Table>
      <p>For more help, see <DocLink to="troubleshooting" hash="svg-warnings">Troubleshooting</DocLink>.</p>
    </>
  );
}
