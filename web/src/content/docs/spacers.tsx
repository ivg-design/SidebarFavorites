import type { DocMeta } from "./types";
import Callout from "@/components/docs/Callout";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "spacers",
  title: "Spacers",
  group: "Guides",
  description: "A spacer is a blank row in Finder's sidebar, with no icon and no name, that separates groups of favorites. This page shows how to add one, how to move it with the arrows, what clicking it does, which helper app and files it uses, and how to remove it. Read it if you want gaps in a long sidebar.",
  keywords: ["spacer", "separator", "divider", "blank row", "gap", "group", "arrows", "move", "reorder", "helper app", "spacers.noindex", "do-nothing"],
  excerpt: "Click the dashed-rectangle button next to + to add a blank row to Finder's sidebar, then move it into place with the arrows on its row. Clicking a spacer does nothing; a small helper app makes that possible.",
  sections: [
    { id: "what-it-is", title: "What a spacer is" },
    { id: "add", title: "Add a spacer" },
    { id: "place", title: "Place a spacer" },
    { id: "clicking", title: "What clicking a spacer does" },
    { id: "helper", title: "The helper app and its files" },
    { id: "remove", title: "Remove a spacer" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="what-it-is">What a spacer is</H2>
      <p>A spacer is a row in Finder&rsquo;s sidebar with no icon and no name. It leaves a gap between favorites, so a long sidebar reads in groups. In the manager window a spacer is listed with the title <strong>Spacer</strong>. In the <DocLink to="menu-bar-popover">menu bar menu</DocLink> it shows as a divider.</p>

      <H2 id="add">Add a spacer</H2>
      <p>The button for a spacer is the dashed rectangle next to <strong>+</strong> at the top of the manager window. Its help text reads <q>Add Spacer - a blank row in Finder&rsquo;s sidebar, opened by a do-nothing helper app</q>. A spacer needs no choices, so no editor opens.</p>
      <Steps>
        <Step title={<>Click the dashed-rectangle button next to <strong>+</strong>.</>} see={<>An alert titled <q>Spacers use a do-nothing helper app</q> explains what the app is about to create, and how to place the spacer. Once you choose <strong>Add, and Don&rsquo;t Show Again</strong>, later clicks add a spacer at once.</>}>
          <p>The alert has three buttons:</p>
          <Table label="Buttons on the spacer alert">
            <thead><tr><th>Button</th><th>What it does</th></tr></thead>
            <tbody>
              <tr><td><strong>Add Spacer</strong></td><td>Adds the spacer. The alert appears again next time.</td></tr>
              <tr><td><strong>Add, and Don&rsquo;t Show Again</strong></td><td>Adds the spacer and stops showing the alert.</td></tr>
              <tr><td><strong>Cancel</strong></td><td>Adds nothing.</td></tr>
            </tbody>
          </Table>
        </Step>
        <Step title="Find the new row in the manager window." see={<>A row titled <strong>Spacer</strong>, and a blank row at the bottom of Finder&rsquo;s sidebar.</>} />
      </Steps>

      <H2 id="place">Place a spacer</H2>
      <p>Finder cannot drag a spacer, because a blank row has nothing to grab. You move it from the manager window instead. While at least one spacer is enabled, a strip above the list says so: <q>Finder can&rsquo;t drag a spacer. To move one, use the</q> up and down arrows <q>on its row below - each click moves it one place in Finder&rsquo;s sidebar.</q></p>
      <Steps>
        <Step title={<>Find the spacer&rsquo;s row, labelled <strong>Spacer</strong>.</>} see="Its up and down arrow buttons are always visible, not only when you point at the row." />
        <Step title="Click the up arrow or the down arrow." see={<>The spacer moves one place in Finder&rsquo;s sidebar. The help text says <q>Move this spacer up one place in Finder&rsquo;s sidebar</q> or <q>Move this spacer down one place in Finder&rsquo;s sidebar</q>.</>}>
          <p>Click again for each further place.</p>
        </Step>
      </Steps>
      <p>A spacer row has no <strong>Reveal</strong> or <strong>Edit</strong> button, because it has no folder to show and nothing to edit. <strong>Delete</strong> appears when you point at the row.</p>

      <H2 id="clicking">What clicking a spacer does</H2>
      <p>Nothing. A sidebar row has to point at something, and a row that points at a folder opens it. So each spacer points at an empty file with a blank name, and only one small helper app can open that file. The helper starts when you click, quits at once, and shows no window and no Dock icon. Nothing is left running.</p>

      <H2 id="helper">The helper app and its files</H2>
      <p>The app creates the helper when you add the first spacer, and says so in the alert first. It makes the helper, signs it with an ad-hoc signature, and registers it with macOS as the only app for the private file type that spacers use.</p>
      <Table label="What spacers put on disk">
        <thead><tr><th>Item</th><th>What it is</th><th>Where</th></tr></thead>
        <tbody>
          <tr><td>The helper</td><td>A do-nothing app named <q>SidebarFavorites Spacer</q>, shared by every spacer.</td><td><code>~/Library/Application Support/SidebarFavorites/Spacers.noindex</code></td></tr>
          <tr><td>One file for each spacer</td><td>An empty file with a blank name, of a private type that only the helper opens.</td><td>A folder of its own inside <code>Spacers.noindex</code>.</td></tr>
        </tbody>
      </Table>
      <p>The <code>.noindex</code> ending keeps the folder out of Spotlight. A spacer is stored in <DocLink to="config-json" hash="favorites">config.json</DocLink> as a favorite whose <code>kind</code> is <code>spacer</code>.</p>

      <H2 id="remove">Remove a spacer</H2>
      <Steps>
        <Step title="Point at the spacer's row in the manager window and click Delete." see="The row leaves the list and Finder's sidebar, and its file is deleted.">
          <p>Removing the last spacer also deletes the helper.</p>
        </Step>
      </Steps>
      <Callout kind="note">Uninstalling leaves the spacer files and helper in the data folder until you delete it. See <DocLink to="uninstalling" hash="left-behind">Uninstalling</DocLink>.</Callout>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Spacer problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>Finder will not let you drag the spacer.</td><td>A blank row has nothing to grab.</td><td>Use the arrows on its row in the manager window.</td></tr>
          <tr><td>The alert appears each time you add a spacer.</td><td>You chose <strong>Add Spacer</strong>, not <strong>Add, and Don&rsquo;t Show Again</strong>.</td><td>Choose <strong>Add, and Don&rsquo;t Show Again</strong> next time.</td></tr>
          <tr><td>The spacer is missing from Finder&rsquo;s sidebar.</td><td>The spacer is switched off, or its row was removed in Finder.</td><td>Switch it on, or press <strong>Refresh</strong> in the manager window. The app adds the row again, at the bottom.</td></tr>
        </tbody>
      </Table>
      <p>For more help, see <DocLink to="troubleshooting" hash="spacer-drag">Troubleshooting</DocLink>.</p>
    </>
  );
}
