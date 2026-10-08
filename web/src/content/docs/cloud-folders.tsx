import type { DocMeta } from "./types";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "cloud-folders",
  title: "Cloud folders",
  group: "Guides",
  description: "Folders in iCloud Drive and in the cloud providers under ~/Library/CloudStorage can have a sidebar icon like any local folder. This page lists which locations work, shows how to add one, and explains why it works. Read it if your files live in iCloud Drive, Google Drive, Dropbox or OneDrive.",
  keywords: ["icloud", "icloud drive", "cloudstorage", "google drive", "dropbox", "onedrive", "fileprovider", "symlink", "cloud"],
  excerpt: "Folders in iCloud Drive and ~/Library/CloudStorage work exactly like local ones. The icon is set on the sidebar row, so nothing is written into the synced folder.",
  sections: [
    { id: "which-locations", title: "Which cloud locations work" },
    { id: "add-one", title: "Add a cloud folder" },
    { id: "why-it-works", title: "Why it works" },
    { id: "cannot-take-icons", title: "What does not take an icon" },
    { id: "symlinks", title: "Favorites that point at a symlink" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="which-locations">Which cloud locations work</H2>
      <p>Any folder inside these locations can be a favorite. The app treats it exactly like a folder on your disk.</p>
      <Table label="Cloud locations that take an icon">
        <thead><tr><th>Location</th><th>Where it is on disk</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>iCloud Drive</td><td>The iCloud Drive location in Finder.</td><td>Pick a folder inside iCloud Drive. Finder&rsquo;s own iCloud Drive row cannot take an icon.</td></tr>
          <tr><td>Google Drive</td><td><code>~/Library/CloudStorage</code></td><td>Pick a folder inside the Google Drive folder that the provider creates there.</td></tr>
          <tr><td>Dropbox</td><td><code>~/Library/CloudStorage</code></td><td>Pick a folder inside the Dropbox folder that the provider creates there.</td></tr>
          <tr><td>OneDrive</td><td><code>~/Library/CloudStorage</code></td><td>Pick a folder inside the OneDrive folder that the provider creates there.</td></tr>
          <tr><td>Other providers</td><td><code>~/Library/CloudStorage</code></td><td>Folders under <code>~/Library/CloudStorage</code> work the same way, whichever provider put them there.</td></tr>
        </tbody>
      </Table>

      <H2 id="add-one">Add a cloud folder</H2>
      <p>You add a cloud folder the same way as any other folder. The steps below are the short form; <DocLink to="quick-start">Quick start</DocLink> has the full walk-through.</p>
      <Steps>
        <Step title={<>Click <strong>+</strong> in the manager window.</>} see="The favorite editor opens in its own window." />
        <Step title={<>Click <strong>Browse...</strong> and choose the folder inside iCloud Drive or <code>~/Library/CloudStorage</code>.</>} see="The folder path is filled in and the name follows the folder." />
        <Step title="Choose an SF Symbol or a custom SVG for the icon." />
        <Step title={<>Click <strong>Add</strong>.</>} see="The folder appears in Finder's sidebar with your icon. If Finder still shows a stale icon, a Restart Finder banner appears." />
      </Steps>

      <H2 id="why-it-works">Why it works</H2>
      <p>SidebarFavorites sets the icon on the sidebar row, not on the folder. Finder looks up the icon through macOS, which does not care whether the path is local, in iCloud Drive or in a cloud provider&rsquo;s folder. The same mechanism therefore covers every kind of folder.</p>
      <Table label="What the app does and does not touch">
        <thead><tr><th>Part</th><th>What happens</th></tr></thead>
        <tbody>
          <tr><td>The folder</td><td>Adding a favorite writes nothing into the folder, so nothing is uploaded or synced because of it.</td></tr>
          <tr><td>The sidebar row</td><td>The app adds the row and stores a short icon code on it.</td></tr>
          <tr><td>The icon</td><td>It comes from one small helper bundle in the app&rsquo;s own folder. No extension runs for it and you enable nothing in System Settings.</td></tr>
        </tbody>
      </Table>
      <p>For the full mechanism, see <DocLink to="how-it-works">How it works</DocLink>.</p>

      <H2 id="cannot-take-icons">What does not take an icon</H2>
      <p>Finder&rsquo;s own rows for iCloud Drive and for the cloud providers in Locations cannot take a custom icon. macOS stores one and never draws it, so the app leaves those rows alone. Add a folder inside the cloud location instead. The full list is in <DocLink to="disks-and-shares" hash="cannot-take-icons">Rows that cannot take an icon</DocLink>.</p>

      <H2 id="symlinks">Favorites that point at a symlink</H2>
      <p>A favorite whose folder path is a symlink to a cloud folder keeps working. The app matches a sidebar row by the path as you typed it and by the path the symlink leads to, so the row is found either way. You can also point the favorite at the real folder.</p>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Cloud folder problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>A warning in the manager window of the form <q>Name: folder no longer exists at</q> followed by the path.</td><td>The folder is not on disk. The provider may not be running, or you may be signed out of it.</td><td>Start the provider and make sure the folder is there in Finder. Then press <strong>Refresh</strong> in the manager window.</td></tr>
          <tr><td>A cloud folder&rsquo;s row shows a plain folder instead of its glyph.</td><td>The row lost its glyph while the account was syncing. This happens more often with several accounts in the sidebar.</td><td>Press <strong>Refresh</strong> in the manager window. It redraws cloud rows as well as disks.</td></tr>
          <tr><td>The sidebar shows a stale icon.</td><td>Finder has not redrawn the row yet.</td><td>Press <strong>Restart Finder</strong> on the banner, or in Settings.</td></tr>
          <tr><td>You cannot give Finder&rsquo;s iCloud Drive row an icon.</td><td>Finder&rsquo;s own cloud rows never draw a custom icon.</td><td>Add a folder inside iCloud Drive instead.</td></tr>
        </tbody>
      </Table>
      <p>For other problems, see <DocLink to="troubleshooting">Troubleshooting</DocLink>.</p>
    </>
  );
}
