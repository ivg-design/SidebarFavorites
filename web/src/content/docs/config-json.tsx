import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import Callout from "@/components/docs/Callout";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { MenuPath } from "@/components/docs/Inline";
import { H2, H3 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "config-json",
  title: "config.json",
  group: "Reference",
  description: "SidebarFavorites keeps your favorites and settings in one JSON file. This page shows where the file is, what every field means, and how to back it up or recover it. Read it if you want to inspect, back up or hand-edit your setup. You never need the file for everyday use.",
  keywords: ["config", "configuration", "json", "application support", "settings", "backup", "corrupt", "reveal backup", "osType", "iconScale", "locationsOnly", "mode", "icons folder", "signingIdentity"],
  excerpt: "Favorites and settings live in ~/Library/Application Support/SidebarFavorites/config.json. An unreadable file is moved aside, never wiped.",
  sections: [
    { id: "location", title: "Where the file is" },
    { id: "structure", title: "The shape of the file" },
    { id: "top-level", title: "Top-level fields" },
    { id: "settings", title: "Settings fields" },
    { id: "favorites", title: "Favorite fields" },
    { id: "editing", title: "Edit the file by hand" },
    { id: "if-unreadable", title: "If the file cannot be read" },
  ],
};

const MINIMAL = `{
  "favorites" : [],
  "settings" : {
    "launchAtLogin" : false,
    "showInMenuBar" : true,
    "signingIdentity" : "automatic"
  },
  "version" : 3
}`;

const REALISTIC = `{
  "favorites" : [
    {
      "createdAt" : "2026-09-12T09:30:00Z",
      "enabled" : true,
      "folderPath" : "~/Projects",
      "iconScale" : 1,
      "iconType" : "sfSymbol",
      "iconValue" : "hammer.fill",
      "id" : "5F0C2B1E-8A44-4E0B-9C59-2D0D5B7A6E11",
      "locationsOnly" : false,
      "mode" : "regular",
      "name" : "Projects",
      "osType" : "S000",
      "sidebarItemID" : 412,
      "sidebarProvenance" : "managed",
      "updatedAt" : "2026-09-12T09:30:00Z"
    },
    {
      "createdAt" : "2026-09-14T16:05:00Z",
      "customSVGPath" : "client-logo.svg",
      "enabled" : true,
      "folderPath" : "~/Documents/Clients",
      "iconScale" : 0.9,
      "iconType" : "custom",
      "iconValue" : "client-logo",
      "id" : "A3D7E0C4-11B2-4F6A-8E3D-7C9B0F2A4D55",
      "locationsOnly" : false,
      "mode" : "advanced",
      "name" : "Clients",
      "osType" : "S001",
      "sidebarItemID" : 418,
      "sidebarProvenance" : "adopted",
      "updatedAt" : "2026-09-20T11:42:00Z"
    }
  ],
  "helperDigest" : "9b1f…c27a",
  "helperGeneration" : 7,
  "settings" : {
    "launchAtLogin" : false,
    "showInMenuBar" : true,
    "signingIdentity" : "automatic"
  },
  "version" : 3
}`;

export function Body() {
  return (
    <>
      <H2 id="location">Where the file is</H2>
      <p>Everything the app stores is in one folder in your Library. The app creates the folder the first time it runs.</p>
      <CodeBlock lang="files" title="Folder" code="~/Library/Application Support/SidebarFavorites/" label="The SidebarFavorites data folder" />
      <p>To open it, choose <MenuPath items={["Finder", "Go", "Go to Folder…"]} />, paste the path and press Return. The folder holds these items:</p>
      <Table label="Files and folders in the data folder">
        <thead><tr><th>Item</th><th>What it holds</th><th>Safe to delete?</th></tr></thead>
        <tbody>
          <tr><td><code>config.json</code></td><td>Your favorites and settings. This page describes it.</td><td>No. Deleting it removes every favorite from the app.</td></tr>
          <tr><td><code>Icons/</code></td><td>The SVG files you imported, stored exactly as you supplied them.</td><td>No. Custom icons are rebuilt from these files.</td></tr>
          <tr><td><code>IconBackups/</code></td><td>Copies of folder icons the app removed when you chose <strong>Remove its icon</strong>.</td><td>Yes, once you are sure you do not want an icon back.</td></tr>
          <tr><td><code>SidebarFavoritesIcons.app</code></td><td>The helper bundle that carries the icons. The app rebuilds it when it is missing.</td><td>Leave it. See <DocLink to="how-it-works" hash="helper-bundle">How it works</DocLink>.</td></tr>
          <tr><td><code>AdvancedApps/</code></td><td>One small helper for each favorite in Both icons mode.</td><td>Leave it. The app adds and removes helpers itself.</td></tr>
          <tr><td><code>config.pre-1.0.json</code></td><td>A copy of an older configuration, made once before the app converted it. It is present only if such a conversion happened.</td><td>Yes.</td></tr>
          <tr><td><code>config.corrupt-&lt;timestamp&gt;.json</code></td><td>A configuration the app could not read and moved aside. See <a href="#if-unreadable">If the file cannot be read</a>.</td><td>Yes, after you have recovered what you need.</td></tr>
        </tbody>
      </Table>

      <H2 id="structure">The shape of the file</H2>
      <p><code>config.json</code> is one JSON object. It has a list of favorites, a small settings object, and three values the app uses for its own bookkeeping. The app writes the keys in alphabetical order and saves the whole file in one step, so a crash cannot leave a half-written file.</p>
      <p>This is the smallest valid file. It is what the app writes before you add a favorite:</p>
      <CodeBlock lang="json" title="config.json, empty" code={MINIMAL} label="The smallest valid config.json" />
      <p>This is a realistic file with two favorites. The first is a folder with an SF Symbol. The second uses an imported SVG, shown at 90 percent, in Both icons mode:</p>
      <CodeBlock lang="json" title="config.json, two favorites" code={REALISTIC} label="A config.json with two favorites" />

      <H2 id="top-level">Top-level fields</H2>
      <p>These five keys sit at the top of the file.</p>
      <Table label="Top-level config fields">
        <thead><tr><th>Field</th><th>Type</th><th>What it holds</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>version</code></td><td>Number</td><td>The layout of the file. The app writes <code>3</code>. Do not change it.</td><td><code>3</code></td></tr>
          <tr><td><code>favorites</code></td><td>List</td><td>One object for each favorite. See <a href="#favorites">Favorite fields</a>.</td><td>An empty list.</td></tr>
          <tr><td><code>settings</code></td><td>Object</td><td>The app&rsquo;s settings. See <a href="#settings">Settings fields</a>.</td><td>The defaults below.</td></tr>
          <tr><td><code>helperDigest</code></td><td>Text</td><td>A SHA-256 fingerprint of the icons the helper bundle was last built from. When it has not changed, the app skips the rebuild.</td><td>Absent until the first build.</td></tr>
          <tr><td><code>helperGeneration</code></td><td>Number</td><td>A counter that goes up by one on every rebuild of the helper bundle, so macOS notices the new bundle.</td><td><code>1</code></td></tr>
        </tbody>
      </Table>
      <p><code>helperDigest</code> and <code>helperGeneration</code> are bookkeeping. If you delete <code>helperDigest</code>, the app rebuilds the helper bundle the next time it syncs, which is harmless.</p>

      <H2 id="settings">Settings fields</H2>
      <p>The <code>settings</code> object holds three values. The first two are the switches in the Settings window. The third has no control in the app and can only be changed here.</p>
      <Table label="Settings fields">
        <thead><tr><th>Field</th><th>Type</th><th>What it does</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>launchAtLogin</code></td><td>true or false</td><td>Mirrors the <strong>Launch at Login</strong> switch.</td><td><code>false</code></td></tr>
          <tr><td><code>showInMenuBar</code></td><td>true or false</td><td>Mirrors the <strong>Show in Menu Bar</strong> switch.</td><td><code>true</code></td></tr>
          <tr><td><code>signingIdentity</code></td><td>Text</td><td>Chooses how the app signs the helpers it generates for Both icons mode.</td><td><code>automatic</code></td></tr>
        </tbody>
      </Table>
      <H3 id="signing-identity">Values of signingIdentity</H3>
      <p>Leave this at <code>automatic</code> unless a helper fails to load and you know which certificate should sign it.</p>
      <Table label="signingIdentity values">
        <thead><tr><th>Value</th><th>What it does</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td><code>automatic</code></td><td>Lets the app pick the signing method.</td><td>Always, unless you have a reason below.</td></tr>
          <tr><td><code>-</code></td><td>Signs ad hoc, with no certificate.</td><td>You have no signing certificate and want to say so explicitly.</td></tr>
          <tr><td><code>Apple Development</code></td><td>Signs with your Apple Development certificate.</td><td>You build the app yourself and test with a development certificate.</td></tr>
          <tr><td><code>Developer ID Application</code></td><td>Signs with your Developer ID Application certificate.</td><td>You build and distribute the app yourself.</td></tr>
        </tbody>
      </Table>

      <H2 id="favorites">Favorite fields</H2>
      <p>Each object in <code>favorites</code> describes one favorite. The fields fall into three groups: what you chose, how the icon is drawn, and how the favorite is tied to its row in Finder&rsquo;s sidebar.</p>
      <H3 id="favorite-identity">What you chose</H3>
      <Table label="Favorite fields: identity">
        <thead><tr><th>Field</th><th>Type</th><th>What it holds</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>id</code></td><td>UUID</td><td>Identifies the favorite. Required, and unique in the file.</td><td></td></tr>
          <tr><td><code>name</code></td><td>Text</td><td>The name shown in the app. Required. It is the folder&rsquo;s own name, because Finder labels a sidebar row with the folder name.</td><td></td></tr>
          <tr><td><code>folderPath</code></td><td>Text</td><td>The folder, as a path. Required. A leading <code>~</code> stands for your home folder.</td><td></td></tr>
          <tr><td><code>enabled</code></td><td>true or false</td><td>Whether the favorite is active. A disabled favorite stays in the list but its icon is not applied.</td><td><code>true</code></td></tr>
          <tr><td><code>createdAt</code></td><td>Date</td><td>When the favorite was added, as an ISO 8601 date in UTC.</td><td>The time of loading.</td></tr>
          <tr><td><code>updatedAt</code></td><td>Date</td><td>When the favorite was last changed, in the same format.</td><td>The time of loading.</td></tr>
        </tbody>
      </Table>
      <H3 id="favorite-icon">How the icon is drawn</H3>
      <Table label="Favorite fields: icon">
        <thead><tr><th>Field</th><th>Type</th><th>What it holds</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>iconType</code></td><td>Text</td><td>The kind of icon: <code>sfSymbol</code> for an SF Symbol, or <code>custom</code> for an imported SVG.</td><td><code>sfSymbol</code></td></tr>
          <tr><td><code>iconValue</code></td><td>Text</td><td>The symbol&rsquo;s name. For an SF Symbol it is the system name, such as <code>hammer.fill</code>.</td><td><code>folder.fill</code></td></tr>
          <tr><td><code>customSVGPath</code></td><td>Text</td><td>For a custom icon, the file name of the stored SVG inside <code>Icons/</code>.</td><td>Absent.</td></tr>
          <tr><td><code>iconScale</code></td><td>Number</td><td>The size slider for a custom icon, from <code>0.5</code> to <code>1.5</code>. A value outside that range is pulled back into it. SF Symbols ignore it.</td><td><code>1</code></td></tr>
          <tr><td><code>mode</code></td><td>Text</td><td>How the icon reaches the row: <code>regular</code>, or <code>advanced</code> for Both icons mode. See <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</td><td><code>regular</code></td></tr>
        </tbody>
      </Table>
      <H3 id="favorite-binding">How it is tied to the sidebar</H3>
      <p>The app fills in these fields. They record which sidebar row belongs to the favorite, so that removing the favorite undoes exactly what adding it did.</p>
      <Table label="Favorite fields: sidebar binding">
        <thead><tr><th>Field</th><th>Type</th><th>What it holds</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>osType</code></td><td>Text</td><td>The four-character code that links the row to its icon, such as <code>S000</code>. The app assigns it once and never changes it. It is case-sensitive.</td><td>Absent until assigned.</td></tr>
          <tr><td><code>sidebarItemID</code></td><td>Number</td><td>Finder&rsquo;s identifier for the sidebar row.</td><td>Absent until a row is bound.</td></tr>
          <tr><td><code>sidebarProvenance</code></td><td>Text</td><td>Where the row came from. See the values below.</td><td><code>unbound</code></td></tr>
          <tr><td><code>locationsOnly</code></td><td>true or false</td><td>For a mounted disk or share: put the icon on Finder&rsquo;s own Locations row and add no Favorites row. See <DocLink to="disks-and-shares">Disks and network shares</DocLink>.</td><td><code>false</code></td></tr>
        </tbody>
      </Table>
      <Table label="sidebarProvenance values">
        <thead><tr><th>Value</th><th>Meaning</th><th>What removing the favorite does</th></tr></thead>
        <tbody>
          <tr><td><code>managed</code></td><td>The app added the row to the sidebar.</td><td>The row is removed.</td></tr>
          <tr><td><code>adopted</code></td><td>The row was already in your sidebar when you added the favorite.</td><td>The row stays and gets its original icon back.</td></tr>
          <tr><td><code>unbound</code></td><td>The favorite has no row of its own.</td><td>Nothing in the sidebar changes.</td></tr>
        </tbody>
      </Table>

      <H2 id="editing">Edit the file by hand</H2>
      <p>The app is the intended editor, and everything except <code>signingIdentity</code> has a control there. If you do edit the file, the app must not be running, because it reads the file at launch and writes it again whenever something changes.</p>
      <Steps>
        <Step title={<>Quit SidebarFavorites: choose <strong>Quit SidebarFavorites</strong> from its menu bar menu.</>} see="The icons stay in Finder's sidebar. They do not need the app to be running." />
        <Step title={<>Copy <code>config.json</code> to another folder as a backup.</>} />
        <Step title="Open config.json in a plain-text editor, make the change and save.">
          <p>Keep the file valid JSON. Do not change <code>id</code>, <code>osType</code>, <code>sidebarItemID</code> or <code>sidebarProvenance</code>: they tie each favorite to a real row in the sidebar.</p>
        </Step>
        <Step title="Open SidebarFavorites again." see="Your favorites are listed, with the change applied." />
      </Steps>
      <Callout kind="tip">To back up your whole setup, copy <code>config.json</code> and the <code>Icons</code> folder together. The SVG files in <code>Icons</code> are what custom icons are rebuilt from.</Callout>

      <H2 id="if-unreadable">If the file cannot be read</H2>
      <p>A file that is not valid JSON, or that lacks a required field, cannot be loaded. The app never deletes it. This is what happens instead:</p>
      <Table label="What happens when config.json cannot be read">
        <thead><tr><th>What the app does</th><th>What you see</th></tr></thead>
        <tbody>
          <tr><td>It renames the file to <code>config.corrupt-&lt;timestamp&gt;.json</code> in the same folder.</td><td>The file is still there, under its new name.</td></tr>
          <tr><td>It starts with a new, empty configuration.</td><td>The manager window lists no favorites.</td></tr>
          <tr><td>It reports the problem in Settings.</td><td>A <strong>Configuration Issue</strong> notice that begins <q>Your configuration file could not be read and was moved aside.</q>, with a <strong>Reveal Backup</strong> button.</td></tr>
        </tbody>
      </Table>
      <p>To recover your favorites:</p>
      <Steps>
        <Step title={<>Open Settings and click <strong>Reveal Backup</strong>.</>} see="Finder opens the data folder with the renamed file selected." />
        <Step title="Quit SidebarFavorites." />
        <Step title="Open the renamed file in a text editor and repair the JSON.">
          <p>The usual causes are a missing comma or quotation mark after a manual edit, or a favorite without <code>id</code>, <code>name</code> or <code>folderPath</code>.</p>
        </Step>
        <Step title={<>Delete the new <code>config.json</code>, then rename the repaired file to <code>config.json</code>.</>} />
        <Step title="Open SidebarFavorites." see="Your favorites are back in the list." />
      </Steps>
      <p>A file that is valid but has fields missing is not treated as unreadable. Every field except <code>id</code>, <code>name</code> and <code>folderPath</code> falls back to its default.</p>
    </>
  );
}
