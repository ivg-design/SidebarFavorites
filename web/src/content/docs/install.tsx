import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import Callout from "@/components/docs/Callout";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";
import { BREW_LINES, RELEASES_URL } from "@/lib/config";

export const meta: DocMeta = {
  slug: "install",
  title: "Install",
  navTitle: "Install (Homebrew / DMG)",
  group: "Getting started",
  description: "Install SidebarFavorites with Homebrew or from the signed, notarized DMG. Requires macOS 13.0 (Ventura) or later.",
  keywords: ["homebrew", "brew", "cask", "tap", "trust", "dmg", "download", "gatekeeper", "notarized", "ventura", "requirements"],
  excerpt: "Three brew commands, or download the DMG and drag SidebarFavorites Manager to Applications. Releases are Developer ID signed and notarized.",
  sections: [
    { id: "homebrew", title: "Homebrew" },
    { id: "direct-download", title: "Direct download" },
    { id: "requirements", title: "Requirements" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="homebrew">Homebrew</H2>
      <CodeBlock code={BREW_LINES.join("\n")} prompt label="Homebrew install commands" />
      <p><code>brew trust</code> is required once. Homebrew asks you to explicitly trust a third-party tap before it will load casks from it.</p>
      <H2 id="direct-download">Direct download</H2>
      <ol>
        <li>Download the latest DMG from <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">Releases</a>.</li>
        <li>Drag <strong>SidebarFavorites Manager</strong> to Applications.</li>
        <li>Open it.</li>
      </ol>
      <p>Releases are Developer ID signed, notarized and stapled, so the app opens normally. There is no Gatekeeper detour and no &ldquo;Open Anyway&rdquo; step.</p>
      <H2 id="requirements">Requirements</H2>
      <p>macOS 13.0 (Ventura) or later.</p>
      <Callout>The app is only needed when you want to add, edit or remove a favorite. Quit it and the icons stay. Next: the <DocLink to="quick-start">Quick start</DocLink>.</Callout>
    </>
  );
}
