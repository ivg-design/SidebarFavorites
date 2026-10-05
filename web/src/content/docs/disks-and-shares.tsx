import type { DocMeta } from "./types";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "disks-and-shares",
  title: "Disks and network shares",
  group: "Guides",
  description: "A mounted disk or network share can have its own sidebar icon, either as a row under Favorites or on the row Finder already shows under Locations. This page explains the choice, how to add a volume, and which rows cannot take an icon. Read it if you want an icon on an external drive or a server.",
  keywords: ["disk", "volume", "network share", "server", "smb", "locations", "mounted", "eject", "icloud drive", "airdrop", "computer", "network", "show in locations only"],
  excerpt: "A volume favorite either adds a Favorites row or, with Show in Locations only, icons the row Finder already lists under Locations. Finder's own special rows cannot take an icon.",
  sections: [
    { id: "what-for", title: "What this page is for" },
    { id: "two-ways", title: "Choose where the icon appears" },
    { id: "add-volume", title: "Add a disk or share" },
    { id: "locations-rows", title: "What the app does to Locations rows" },
    { id: "ejected", title: "Ejected, offline, turned off or removed" },
    { id: "cannot-take-icons", title: "Rows that cannot take an icon" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="what-for">What this page is for</H2>
      <p>Finder lists every mounted disk and server under <strong>Locations</strong> in the sidebar, whether or not you have a favorite for it. A volume favorite gives that disk or server a custom icon. A disk shows up twice when you also add it under <strong>Favorites</strong>, so the app can either icon both rows or only the one Finder already has.</p>

      <H2 id="two-ways">Choose where the icon appears</H2>
      <p>When the folder you choose is a mounted volume, the favorite editor shows a switch named <strong>Show in Locations only</strong>. It is not shown for ordinary folders.</p>
      <Table label="The Show in Locations only choice">
        <thead><tr><th>Option</th><th>What appears in the sidebar</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td><strong>Show in Locations only</strong> off (the default)</td><td>A row under Favorites with your icon. Finder&rsquo;s Locations row for the same disk gets the same icon, so the two agree.</td><td>You want the disk in Favorites, or it is a network share.</td></tr>
          <tr><td><strong>Show in Locations only</strong> on</td><td>No row under Favorites. Only Finder&rsquo;s Locations row for the disk gets your icon.</td><td>The disk already appears under Locations and you do not want a second row.</td></tr>
        </tbody>
      </Table>
      <p>For a network share, leave the option off. Finder builds a share&rsquo;s Locations entry itself and it cannot take an icon, so with the option on the app reports that it can&rsquo;t show the share in Locations only.</p>

      <H2 id="add-volume">Add a disk or share</H2>
      <Steps>
        <Step title={<>Mount the disk or connect to the server so it is available in Finder.</>} />
        <Step title={<>Click <strong>+</strong> in the manager window, then <strong>Browse...</strong>, and choose the disk.</>} see={<>The <strong>Show in Locations only</strong> switch appears under the folder path.</>} />
        <Step title={<>Decide whether to turn <strong>Show in Locations only</strong> on.</>}>
          <p>See the table above. Leave it off if you are not sure.</p>
        </Step>
        <Step title="Choose an SF Symbol or a custom SVG for the icon." />
        <Step title={<>Click <strong>Add</strong>.</>} see="The icon appears in the sidebar: under Favorites and Locations, or in Locations only, depending on your choice. If Finder still shows a stale icon, press Restart Finder on the banner." />
      </Steps>
      <p>If the disk has a custom icon of its own, the editor asks what to do about it. See <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>

      <H2 id="locations-rows">What the app does to Locations rows</H2>
      <p>Finder owns the rows in Locations. The app only changes the icon property of a row that is already there.</p>
      <Table label="What the app does and never does to Locations rows">
        <thead><tr><th>The app does</th><th>The app never does</th></tr></thead>
        <tbody>
          <tr><td>Sets your icon on Finder&rsquo;s existing row for the disk.</td><td>Inserts a row into Locations.</td></tr>
          <tr><td>Takes the icon off the row when you turn the favorite off or remove it.</td><td>Moves or deletes a row in Locations.</td></tr>
          <tr><td>Adds a row under Favorites when <strong>Show in Locations only</strong> is off.</td><td>Adds a row under Favorites when <strong>Show in Locations only</strong> is on.</td></tr>
          <tr><td>Skips rows it cannot patch and reports when a share cannot be shown in Locations only.</td><td>Sets an icon on iCloud Drive, Computer, AirDrop or a cloud provider&rsquo;s row.</td></tr>
        </tbody>
      </Table>

      <H2 id="ejected">Ejected, offline, turned off or removed</H2>
      <p>The favorite stays in the manager window in every case below. Nothing is deleted from the disk.</p>
      <Table label="What happens to a volume favorite">
        <thead><tr><th>What happens</th><th>Result</th></tr></thead>
        <tbody>
          <tr><td>The disk is ejected or the share is offline.</td><td>The manager window shows a warning. A favorite with <strong>Show in Locations only</strong> off says <q>Name: folder no longer exists at</q> followed by the path. One with it on says that Finder only lists mounted disks and servers in Locations. Press <strong>Refresh</strong> after the disk is mounted again.</td></tr>
          <tr><td>You turn the favorite off.</td><td>The icon is taken off Finder&rsquo;s Locations row. A Favorites row the app added is removed after you confirm <strong>Turn Off and Remove Row</strong>; one that was already in your sidebar stays with its own icon back.</td></tr>
          <tr><td>You remove the favorite.</td><td>The app asks you to confirm. It takes the icon off the Locations row. It removes a Favorites row it added, and keeps one that was already there.</td></tr>
        </tbody>
      </Table>

      <H2 id="cannot-take-icons">Rows that cannot take an icon</H2>
      <p>These rows ignore a custom icon, so the app leaves them alone.</p>
      <Table label="Rows that cannot take an icon">
        <thead><tr><th>Row</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>iCloud Drive</td><td>Finder builds it as a special entry. macOS stores an icon on it and never draws it.</td></tr>
          <tr><td>Computer</td><td>The same: a special entry that never draws a custom icon.</td></tr>
          <tr><td>AirDrop</td><td>The same: a special entry that never draws a custom icon.</td></tr>
          <tr><td>Network</td><td>The same: a special entry that never draws a custom icon.</td></tr>
          <tr><td>Cloud-provider rows</td><td>Finder shows these as special entries. Add a folder inside the provider instead; see <DocLink to="cloud-folders">Cloud folders</DocLink>.</td></tr>
          <tr><td>The Locations entry of a network share</td><td>Finder builds it from the mount table instead of storing a row, so there is nothing to patch. Leave <strong>Show in Locations only</strong> off to give the share a row under Favorites.</td></tr>
        </tbody>
      </Table>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Disk and share problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>There is no <strong>Show in Locations only</strong> switch.</td><td>The chosen folder is not the root of a mounted volume.</td><td>Choose the disk itself, not a folder inside it.</td></tr>
          <tr><td>A warning that the favorite <q>can&rsquo;t be shown in Locations only</q>.</td><td>The favorite is a network share, or Finder has no Locations row for it.</td><td>Turn <strong>Show in Locations only</strong> off.</td></tr>
          <tr><td>A warning <q>folder no longer exists at</q> followed by the path.</td><td>The disk is not mounted.</td><td>Mount the disk, then press <strong>Refresh</strong> in the manager window.</td></tr>
          <tr><td>The icon disappears again and again.</td><td>The disk carries its own icon, which Finder redraws from.</td><td>Open the favorite and choose one of the options in <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</td></tr>
          <tr><td>Finder still shows a stale icon.</td><td>Finder has not redrawn the row yet.</td><td>Press <strong>Restart Finder</strong> on the banner, or in Settings.</td></tr>
        </tbody>
      </Table>
      <p>For other problems, see <DocLink to="troubleshooting" hash="locations-row">Troubleshooting</DocLink>.</p>
    </>
  );
}
