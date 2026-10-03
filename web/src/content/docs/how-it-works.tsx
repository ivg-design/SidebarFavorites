import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";
import { REPO_URL } from "@/lib/config";

export const meta: DocMeta = {
  slug: "how-it-works",
  title: "How it works",
  group: "Reference",
  description: "The private sidebar-row property, the one helper bundle that carries no code, and what Both icons mode adds.",
  keywords: ["mechanism", "architecture", "overridedicon", "ostype", "launch services", "uti", "helper bundle", "lssharedfilelist", "finder sync", "no daemon", "contributors", "finder restart", "svg pipeline"],
  excerpt: "Every Favorites row can carry a private property holding a four-character code. Finder resolves that code to an icon through Launch Services.",
  sections: [
    { id: "row-property", title: "The row property" },
    { id: "helper-bundle", title: "The helper bundle" },
    { id: "both-icons", title: "Both icons mode" },
    { id: "finder-restarts", title: "Finder restarts" },
    { id: "svg-pipeline", title: "From SVG to symbol" },
    { id: "where-things-live", title: "Where things live" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="row-property">The row property</H2>
      <p>Every row in Finder&rsquo;s Favorites list can carry a private per-item property, <code>com.apple.LSSharedFileList.OverrideIcon.OSType</code>, holding a four-character code. Finder resolves that code to an icon through Launch Services. SidebarFavorites allocates one such code per favorite and sets it on the row.</p>
      <H2 id="helper-bundle">The helper bundle</H2>
      <p>The app also installs a single small helper bundle at:</p>
      <CodeBlock code="~/Library/Application Support/SidebarFavorites/SidebarFavoritesIcons.app" label="Helper bundle path" />
      <p>That bundle declares one UTI per favorite, tagging it with the favorite&rsquo;s code and pointing it at an SF Symbol. It contains <strong>no executable code of any kind</strong>. Its &ldquo;executable&rdquo; is a 17-byte <code>#!/bin/sh</code> no-op that exists only so macOS registers the bundle, and it is never launched. Custom SVGs are compiled into a symbol catalog inside it.</p>
      <p>That is the whole mechanism for a normal favorite: no extension, no daemon, no login item, no launch agent.</p>
      <H2 id="both-icons">Both icons mode</H2>
      <p><strong>Both icons</strong> mode adds one thing, and only for the favorites you turn it on for. Finder draws a sidebar row from a completely separate source when a Finder Sync extension claims that folder: the extension&rsquo;s containing app icon. That path ignores the folder&rsquo;s own icon entirely, which is why the glyph survives.</p>
      <p>So the app generates one tiny host app plus extension per Both-icons favorite in <code>~/Library/Application Support/SidebarFavorites/AdvancedApps/</code>, carrying that favorite&rsquo;s artwork as its symbol. The host quits itself a few seconds after registering; only the extension stays, at about 6 MB. The normal icon code is left on the row underneath, so if the helper is ever disabled the row falls back to it immediately. See <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>
      <H2 id="finder-restarts">Finder restarts</H2>
      <p>Nothing in the app restarts Finder on its own. Only a user action does: the banner button, the Settings action, or the Apply button in the editor. Killing Finder mid-copy would abort the copy and lose every open window, tab and in-flight rename, so a restart is only ever offered. It is owed when a row already on screen had its icon property changed, or when the artwork behind an unchanged code changed (a different SVG, symbol or size). A row inserted with its icon already set draws correctly immediately and owes nothing.</p>
      <H2 id="svg-pipeline">From SVG to symbol</H2>
      <p>A custom SVG goes one way: it is parsed into one flattened outline, checked (only an unreadable, non-SVG, malformed or empty file is rejected, everything else is a warning), wrapped in an SF Symbols template, and compiled into an asset catalog inside the helper bundle by the engine that ships with macOS.</p>
      <H2 id="where-things-live">Where things live</H2>
      <p>Configuration lives in <code>~/Library/Application Support/SidebarFavorites/config.json</code>, and imported artwork in <code>Icons/</code> alongside it. Settings links straight to the helper bundle so you can see it for yourself. See <DocLink to="config-json">config.json</DocLink>.</p>
      <p>For contributors, the full write-up is in <a href={`${REPO_URL}/blob/main/docs/ARCHITECTURE.md`} target="_blank" rel="noopener noreferrer">docs/ARCHITECTURE.md</a> on GitHub.</p>
    </>
  );
}
