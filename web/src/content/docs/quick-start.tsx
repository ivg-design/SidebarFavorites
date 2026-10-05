import type { DocMeta } from "./types";
import { Steps, Step } from "@/components/docs/Steps";
import Figure from "@/components/docs/Figure";
import Table from "@/components/docs/Table";
import { Kbd } from "@/components/docs/Inline";
import { H2, H3 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "quick-start",
  title: "Quick start",
  group: "Getting started",
  description: "This page takes you from an installed app to your first favorite: a folder in Finder’s sidebar with an icon you chose. Read it once; every later favorite uses the same steps.",
  keywords: ["first favorite", "add", "folder", "sf symbol", "getting started", "tutorial", "new favorite", "cmd n", "browse all", "restart finder"],
  excerpt: "Click +, choose the folder, choose an SF Symbol or import an SVG, then click Add. The folder appears in Finder’s sidebar with your icon. Browse All searches every SF Symbol your Mac can draw.",
  sections: [
    { id: "before-you-start", title: "Before you start" },
    { id: "add-a-favorite", title: "Add your first favorite" },
    { id: "choose-the-icon", title: "Choose the icon" },
    { id: "in-finder", title: "What you see in Finder" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="before-you-start">Before you start</H2>
      <p>You need SidebarFavorites installed and a folder you want to give an icon. If the app is not installed yet, follow <DocLink to="install">Install</DocLink> first. The app is the only tool you use; you do not edit any Finder setting by hand.</p>

      <H2 id="add-a-favorite">Add your first favorite</H2>
      <p>A favorite is one folder with one icon. You add it in the favorite editor, which opens in its own window.</p>
      <Steps>
        <Step title={<>Open <strong>SidebarFavorites Manager</strong> from your Applications folder.</>} see={<>The manager window opens. The first time it reads <q>No Favorites</q>.</>}>
          <Figure shot="main-window-empty" alt="The manager window with no favorites: the heading No Favorites, a line of explanation and an Add Favorite button, with a plus button at the top right" caption={<>The manager window before you add anything. <strong>Add Favorite</strong> and the <strong>+</strong> button at the top right both open the editor.</>} />
        </Step>
        <Step title={<>Click <strong>Add Favorite</strong> or <strong>+</strong>, or press <Kbd>⌘N</Kbd>.</>} see={<>A window titled <q>Add Favorite</q> opens. You can move it and resize it, and leave it open beside the list.</>}>
          <p>The shortcut belongs to the menu item <strong>Add Favorite...</strong>, so it works whenever the app is in front.</p>
          <Figure shot="editor-add" alt="The Add Favorite window with no folder chosen: Name, Folder Path with a Browse button, the Mode switch, the icon Type switch, a Symbol Name field with Browse All, a grid of quick-pick symbols and a Preview" caption={<>The editor from top to bottom: <strong>Folder Path</strong>, <strong>Mode</strong>, the icon <strong>Type</strong>, <strong>Symbol Name</strong> with the quick picks, and the <strong>Preview</strong>. <strong>Add</strong> is dimmed until a folder is chosen.</>} />
        </Step>
        <Step title={<>Click <strong>Browse...</strong> next to <strong>Folder Path</strong> and choose the folder.</>} see={<>The path appears in <strong>Folder Path</strong>, and <strong>Name</strong> shows the folder&rsquo;s own name.</>}>
          <p>You can also type or paste a path into the field; <code>~</code> stands for your home folder. The name cannot be edited, because Finder always labels a sidebar row with the folder&rsquo;s real name.</p>
        </Step>
        <Step title={<>Leave <strong>Mode</strong> on <strong>Sidebar icon only</strong>.</>} see="Nothing changes. This is the default and the right choice for most folders.">
          <p><strong>Both icons</strong> is for folders that already carry their own icon. See <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>
        </Step>
        <Step title={<>Choose the icon. <a href="#choose-the-icon">The next section</a> shows both ways.</>} see={<>The <strong>Preview</strong> shows the icon enlarged and as a sidebar row.</>} />
        <Step title={<>Click <strong>Add</strong>.</>} see="The editor closes and the favorite is listed in the manager window.">
          <Figure shot="main-window" alt="The manager window listing seven favorites, each with its icon, folder path, an In Sidebar or Disabled status and a switch, with a plus button at the top right and Refresh in the footer" caption={<>Each favorite is a row with its icon, its folder and a switch. <q>In Sidebar</q> means the row is in Finder&rsquo;s sidebar.</>} />
          <p>The button is disabled until a folder and an icon are chosen, or while the folder already belongs to another favorite. <strong>Apply</strong>, next to it, saves the favorite and restarts Finder while the editor stays open.</p>
        </Step>
      </Steps>

      <H2 id="choose-the-icon">Choose the icon</H2>
      <p>The <strong>Type</strong> switch in the editor picks one of two kinds of icon. Pick the one that fits, then follow its steps.</p>
      <Table label="The two icon types">
        <thead><tr><th>Icon type</th><th>What to do</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td><strong>SF Symbol</strong></td><td>Type a symbol name, click a quick pick, or click <strong>Browse All…</strong>.</td><td>A symbol from Apple&rsquo;s set is what you want. It is the default.</td></tr>
          <tr><td><strong>Custom SVG</strong></td><td>Click <strong>Import SVG...</strong> and choose an SVG file.</td><td>You want your own artwork, such as a logo. See <DocLink to="custom-svg-icons">Custom SVG icons</DocLink>.</td></tr>
        </tbody>
      </Table>

      <H3 id="sf-symbol-icon">Use an SF Symbol</H3>
      <Steps>
        <Step title={<>Make sure <strong>Type</strong> is set to <strong>SF Symbol</strong>.</>} see={<>The <strong>Symbol Name</strong> field, <strong>Browse All…</strong> and a grid of quick-pick symbols are shown.</>} />
        <Step title={<>Click one of the quick picks, or type a name such as <code>hammer.fill</code> or <code>star.circle</code> into <strong>Symbol Name</strong>.</>} see={<>The chosen quick pick is highlighted and the <strong>Preview</strong> redraws with it.</>}>
          <Figure shot="editor-icon-after" alt="The editor for the folder Projects with hammer.fill in Symbol Name, the hammer highlighted in the quick-pick grid and a hammer in the Preview" caption={<>The hammer quick pick is selected: its name is in <strong>Symbol Name</strong> and the <strong>Preview</strong> shows it enlarged and as a sidebar row.</>} />
        </Step>
      </Steps>
      <H3 id="browse-all">Search every symbol with Browse All</H3>
      <p><strong>Browse All…</strong> opens a sheet that searches every SF Symbol this Mac can draw, by name or by keyword, so a search for <q>bin</q> finds <code>trash</code>. The number of symbols depends on your macOS version, and the empty search field states the exact count for your Mac.</p>
      <Steps>
        <Step title={<>Click <strong>Browse All…</strong>.</>} see={<>A sheet titled <q>SF Symbols</q> opens with a search field and a grid of symbols.</>}>
          <Figure shot="symbol-browser" alt="The SF Symbols sheet with hammer typed in the search field, four matching symbols, hammer.fill selected and named at the bottom left, and Cancel and Use Symbol buttons" caption={<>A search for <q>hammer</q>. The selected symbol&rsquo;s name is at the bottom left, next to <strong>Cancel</strong> and <strong>Use Symbol</strong>.</>} />
        </Step>
        <Step title="Click a symbol." see={<>The symbol is outlined, and its name appears at the bottom left of the sheet.</>}>
          <p>Double-clicking a symbol picks it and closes the sheet in one go, and the next step is then done.</p>
        </Step>
        <Step title={<>Click <strong>Use Symbol</strong>.</>} see={<>The sheet closes and <strong>Symbol Name</strong> holds the symbol you chose.</>}>
          <p>If the symbol catalog cannot be read on your Mac, <strong>Browse All…</strong> is not shown and the quick picks and the name field remain.</p>
        </Step>
      </Steps>
      <H3 id="svg-icon">Use your own SVG</H3>
      <p>Set <strong>Type</strong> to <strong>Custom SVG</strong>, click <strong>Import SVG...</strong> and choose a file. The import, the preview and the size slider are described on <DocLink to="custom-svg-icons">Custom SVG icons</DocLink>.</p>

      <H2 id="in-finder">What you see in Finder</H2>
      <p>After you click <strong>Add</strong>, the folder is a row in the Favorites section of Finder&rsquo;s sidebar, drawn with your icon. The row stays in the sidebar when you quit SidebarFavorites, because the icon is registered with macOS and no running process draws it. You need the app only to add, change or remove a favorite.</p>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <p>The manager window reports problems in banners above its footer.</p>
      <Figure shot="main-window-notices" alt="The manager window with two banners above the footer: a collapsed 1 Warning banner and an orange banner saying some icon changes need Finder to restart, with a Restart Finder button" caption={<>The orange banner appears when Finder has not redrawn a row yet. <strong>Restart Finder</strong> is at its right.</>} />
      <Table label="Problems while adding a favorite">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>An orange banner at the bottom of the manager window: <q>Some icon changes need Finder to restart before they appear.</q></td><td>The sidebar has been updated, but Finder has not redrawn the row yet.</td><td>Click <strong>Restart Finder</strong> in the banner. The app never restarts Finder by itself, because a restart closes Finder windows and aborts a copy in progress.</td></tr>
          <tr><td>The editor shows <q>already uses this folder</q>, and <strong>Add</strong> is disabled.</td><td>A folder can have only one favorite, because two would fight over the same sidebar row.</td><td>Edit the favorite named in the message, or choose a different folder.</td></tr>
          <tr><td>The row shows the old icon, or the folder has its own icon.</td><td>Finder caches icons, or the folder carries an icon of its own.</td><td>See <DocLink to="troubleshooting">Troubleshooting</DocLink>.</td></tr>
        </tbody>
      </Table>
    </>
  );
}
