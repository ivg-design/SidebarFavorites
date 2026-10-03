import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import Callout from "@/components/docs/Callout";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "nix-flake",
  title: "Nix flake",
  group: "Reference",
  description: "Run SidebarFavorites with nix run. The package installs the released DMG rather than building from source.",
  keywords: ["nix", "flake", "nix run", "rohanp2051", "nixpkgs", "package"],
  excerpt: "nix run github:ivg-design/SidebarFavorites installs the released DMG. The package is pinned to an older release.",
  sections: [
    { id: "run", title: "Run it" },
    { id: "caveat", title: "What it installs" },
    { id: "thanks", title: "Thanks" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="run">Run it</H2>
      <CodeBlock prompt code="nix run github:ivg-design/SidebarFavorites" label="Nix command" />
      <H2 id="caveat">What it installs</H2>
      <p>This installs the released DMG rather than building from source.</p>
      <Callout kind="warn"><code>nix/default.nix</code> is currently pinned to an older release. For the newest version use <DocLink to="install">Homebrew or the DMG</DocLink>.</Callout>
      <H2 id="thanks">Thanks</H2>
      <p>Thanks to <a href="https://github.com/rohanp2051" target="_blank" rel="noopener noreferrer">@rohanp2051</a> for the initial Nix package.</p>
    </>
  );
}
