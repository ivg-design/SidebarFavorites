import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import Table from "@/components/docs/Table";
import Figure from "@/components/docs/Figure";
import { MenuPath } from "@/components/docs/Inline";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";
import { REPO_URL } from "@/lib/config";

export const meta: DocMeta = {
  slug: "how-it-works",
  title: "How it works",
  group: "Reference",
  description: "How SidebarFavorites puts its own icon on a Finder sidebar row, part by part: the code on the row, the helper bundle, Both icons mode, Finder restarts and the SVG pipeline. Read it if you are curious or want to contribute. You do not need it to use the app.",
  keywords: ["mechanism", "architecture", "overridedicon", "ostype", "launch services", "uti", "helper bundle", "lssharedfilelist", "finder sync", "no daemon", "contributors", "finder restart", "svg pipeline"],
  excerpt: "A sidebar row carries a four-character code. Launch Services resolves the code to an icon declared by one helper bundle. Finder draws it.",
  sections: [
    { id: "overview", title: "The mechanism in brief" },
    { id: "row-property", title: "The row property" },
    { id: "helper-bundle", title: "The helper bundle" },
    { id: "both-icons", title: "Both icons mode" },
    { id: "finder-restarts", title: "Finder restarts" },
    { id: "svg-pipeline", title: "From SVG to symbol" },
    { id: "where-things-live", title: "Where things live" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="overview">The mechanism in brief</H2>
      <p>A row in Finder&rsquo;s sidebar can carry a hidden four-character code. The code points at an icon. A small helper bundle, kept in the app&rsquo;s data folder, declares which icon belongs to which code. Finder looks the code up and draws that icon on the row.</p>
      <p>SidebarFavorites hands out one code for each favorite, writes it on the row, and keeps the helper bundle up to date. Nothing has to keep running for the icons to stay: no background process, no login item, no extension.</p>
      <Table label="The parts of the mechanism">
        <thead><tr><th>Part</th><th>What it is</th><th>Where it lives</th></tr></thead>
        <tbody>
          <tr><td><a href="#row-property">Row property</a></td><td>A four-character code on a sidebar row.</td><td>Finder&rsquo;s Favorites list.</td></tr>
          <tr><td><a href="#helper-bundle">Helper bundle</a></td><td>A small app bundle that declares an icon for each code.</td><td>The app&rsquo;s data folder.</td></tr>
          <tr><td><a href="#both-icons">Both icons helper</a></td><td>An extra helper for each favorite in Both icons mode.</td><td>The <code>AdvancedApps</code> folder.</td></tr>
          <tr><td><a href="#svg-pipeline">SVG pipeline</a></td><td>The steps that turn an imported SVG into a symbol.</td><td>Inside the SidebarFavorites app.</td></tr>
        </tbody>
      </Table>

      <H2 id="row-property">The row property</H2>
      <p>Every row in Finder&rsquo;s Favorites list can carry a private property that holds a four-character code. Finder asks Launch Services, the macOS service that knows which types and icons are registered, for the icon that belongs to the code. SidebarFavorites allocates one code for each favorite and sets it on the row. The code is stored in <code>config.json</code> as <code>osType</code> and never changes.</p>
      <CodeBlock lang="text" title="Property key" code="com.apple.LSSharedFileList.OverrideIcon.OSType" label="The sidebar row property that holds the code" />
      <Table label="Facts about the code">
        <thead><tr><th>Fact</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Shape</td><td>The letter <code>S</code> followed by three characters, such as <code>S000</code>, <code>S001</code>, <code>S002</code>.</td></tr>
          <tr><td>Case</td><td>Case-sensitive. <code>S00A</code> and <code>S00a</code> are different codes.</td></tr>
          <tr><td>Allocation</td><td>The lowest free code is used, and the app checks that no other app already declares it.</td></tr>
        </tbody>
      </Table>

      <H2 id="helper-bundle">The helper bundle</H2>
      <p>Launch Services needs a registered bundle that declares which icon goes with which code. SidebarFavorites keeps exactly one such bundle for all favorites. It declares one type for each favorite, tags it with the favorite&rsquo;s code and names the SF Symbol to draw. Imported SVGs are compiled into a symbol catalog inside the same bundle.</p>
      <CodeBlock lang="files" title="Helper bundle" code="~/Library/Application Support/SidebarFavorites/SidebarFavoritesIcons.app" label="Path of the helper bundle" />
      <Table label="Facts about the helper bundle">
        <thead><tr><th>Question</th><th>Answer</th></tr></thead>
        <tbody>
          <tr><td>Does it contain code?</td><td>No program code. Its executable is a 17-byte shell script that does nothing.</td></tr>
          <tr><td>Why is there an executable at all?</td><td>macOS registers a bundle cleanly only when its executable points at something that can run.</td></tr>
          <tr><td>Is it ever launched?</td><td>No. It is registered with Launch Services and never opened.</td></tr>
          <tr><td>When is it rebuilt?</td><td>When a favorite is added, changed or removed. When nothing changed, the app skips the rebuild.</td></tr>
        </tbody>
      </Table>
      <p>The Settings window links to the bundle in its <strong>Helper App</strong> row, so you can reveal it in Finder yourself.</p>
      <Figure shot="settings" alt="The Settings window: the Launch at Login and Show in Menu Bar switches, an About group with the app name, MIT License, Version and Helper App, and an Actions group with Restart Finder and Remove All Sidebar Icons" caption={<>Look at the <strong>Helper App</strong> row under <strong>About</strong>. It shows the path of the helper bundle and reveals it in Finder when you click it.</>} />

      <H2 id="both-icons">Both icons mode</H2>
      <p>A folder that has an icon of its own can make Finder draw that icon over the sidebar code. Both icons mode keeps your sidebar glyph visible as well. It adds one extra helper for each favorite you switch it on for. Finder draws a sidebar row differently when a Finder Sync extension claims the folder, and that route ignores the folder&rsquo;s own icon. For how to choose the mode, see <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>
      <Table label="Both icons mode">
        <thead><tr><th>Question</th><th>Answer</th></tr></thead>
        <tbody>
          <tr><td>What the app generates</td><td>One small host app with a Finder Sync extension inside it, carrying that favorite&rsquo;s artwork.</td></tr>
          <tr><td>Where it lives</td><td>In the <code>AdvancedApps</code> folder next to the helper bundle.</td></tr>
          <tr><td>What stays running</td><td>Only the extension, at about 6 MB. The host app quits a few seconds after it registers the extension.</td></tr>
          <tr><td>What it is called in System Settings</td><td><code>SBF-</code> followed by the favorite&rsquo;s name.</td></tr>
          <tr><td>What stays underneath</td><td>The normal icon code stays on the row. If you disable the extension, the row falls back to that icon.</td></tr>
        </tbody>
      </Table>
      <CodeBlock lang="files" title="Both icons helpers" code="~/Library/Application Support/SidebarFavorites/AdvancedApps/" label="Folder of generated Both icons helpers" />

      <H2 id="finder-restarts">Finder restarts</H2>
      <p>Finder caches sidebar icons, so a change to a row that is already on screen can stay invisible until Finder relaunches. SidebarFavorites never restarts Finder by itself. Quitting Finder aborts a copy in progress and closes every open window, tab and rename, so the app only offers the restart and waits for you.</p>
      <Table label="Situations and whether Finder must restart">
        <thead><tr><th>Situation</th><th>Restart needed?</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>You add a favorite and the app adds its row.</td><td>No.</td><td>A row inserted with its code already set draws correctly straight away.</td></tr>
          <tr><td>You add a favorite for a folder that is already in your sidebar.</td><td>Yes.</td><td>The row was already on screen, and its icon property changed.</td></tr>
          <tr><td>You change the symbol, the SVG or the size of an existing favorite.</td><td>Yes.</td><td>The code stays the same, but the artwork behind it changed, and Finder keeps drawing the cached artwork.</td></tr>
          <tr><td>You use <strong>Remove All Sidebar Icons</strong> and a row you added yourself had its icon cleared.</td><td>Yes.</td><td>Finder keeps drawing the cleared icon until it relaunches.</td></tr>
          <tr><td>You open the app and nothing changed.</td><td>No.</td><td>No row icon changed, so the app skips the helper rebuild.</td></tr>
        </tbody>
      </Table>
      <p>When a restart is owed, the main window shows the banner <q>Some icon changes need Finder to restart before they appear.</q> Only these three actions restart Finder:</p>
      <Table label="Actions that restart Finder">
        <thead><tr><th>Action</th><th>Where you find it</th></tr></thead>
        <tbody>
          <tr><td>The <strong>Restart Finder</strong> button.</td><td>On the banner in the main window.</td></tr>
          <tr><td>The <strong>Restart Finder</strong> button.</td><td>In the <strong>Actions</strong> section of the Settings window.</td></tr>
          <tr><td>The <strong>Apply</strong> button.</td><td>In the favorite editor. <strong>Save</strong> and <strong>Add</strong> do not restart Finder.</td></tr>
        </tbody>
      </Table>

      <H2 id="svg-pipeline">From SVG to symbol</H2>
      <p>Finder draws sidebar icons from symbols, not from SVG files. When you import an SVG, the app turns it into a symbol in four stages, always in this order. The stages run on the copy stored in <code>Icons/</code> whenever the helper bundle is rebuilt, and your original file is never changed.</p>
      <Table label="Pipeline stages and source files">
        <thead><tr><th>Stage</th><th>What happens</th><th>Source file</th></tr></thead>
        <tbody>
          <tr><td>1. Parse</td><td>Shapes, groups, transforms, styles and strokes are flattened into one filled outline.</td><td><code>SVGGeometryParser.swift</code></td></tr>
          <tr><td>2. Validate</td><td>The import is refused only when the file cannot be read, is not an SVG, is malformed or has no drawable shapes. Everything else becomes a warning. See <DocLink to="troubleshooting" hash="svg-warnings">SVG warnings</DocLink>.</td><td><code>SymbolValidator.swift</code></td></tr>
          <tr><td>3. Template</td><td>The outline is fitted to the height of a symbol, scaled by your size slider, and wrapped in the SF Symbols template that the compiler expects.</td><td><code>SymbolTemplateSynthesizer.swift</code></td></tr>
          <tr><td>4. Compile</td><td>All custom symbols become one <code>Assets.car</code> inside the helper bundle, built by the asset-catalog engine that ships with macOS. One icon that fails to compile does not stop the others.</td><td><code>SymbolCatalogBuilder.swift</code></td></tr>
        </tbody>
      </Table>

      <H2 id="where-things-live">Where things live</H2>
      <p>Everything the app stores is under one folder in your Library. Your favorites and settings are in <code>config.json</code>, your imported SVGs are in <code>Icons/</code>, and the helper bundle sits beside them. The full list of files is on <DocLink to="config-json">config.json</DocLink>. To open the data folder, choose <MenuPath items={["Finder", "Go", "Go to Folder…"]} />.</p>
      <CodeBlock lang="files" title="Data folder" code="~/Library/Application Support/SidebarFavorites/" label="The SidebarFavorites data folder" />
      <p>Contributors can read the full write-up in <a href={`${REPO_URL}/blob/main/docs/ARCHITECTURE.md`} target="_blank" rel="noopener noreferrer">docs/ARCHITECTURE.md</a> on GitHub.</p>
    </>
  );
}
