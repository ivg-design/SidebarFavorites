import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "nix-flake",
  title: "Nix flake",
  group: "Reference",
  description: "SidebarFavorites ships a Nix flake that installs the released DMG. This page is for people who manage their Mac with Nix. It says what the flake installs, which release it is pinned to, and how to run it.",
  keywords: ["nix", "flake", "nix run", "rohanp2051", "nixpkgs", "package"],
  excerpt: "nix run github:ivg-design/SidebarFavorites installs the released DMG. The package is pinned to release 1.2.2.",
  sections: [
    { id: "what-it-does", title: "What the flake does" },
    { id: "run", title: "Run it" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="what-it-does">What the flake does</H2>
      <p>The flake downloads the released DMG from GitHub, unpacks it, and puts <strong>SidebarFavorites Manager</strong> in the Nix store&rsquo;s <code>Applications</code> folder. It does not compile the source. If you want to compile it yourself, see <DocLink to="building-from-source">Building from source</DocLink>. The flake supports Apple silicon and Intel Macs.</p>
      <Table label="What the flake installs">
        <thead><tr><th>Property</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Source</td><td>The DMG attached to the matching GitHub release.</td></tr>
          <tr><td>Pinned version</td><td><code>1.2.2</code>, set in <code>nix/default.nix</code>.</td></tr>
          <tr><td>Builds from source?</td><td>No.</td></tr>
          <tr><td>Systems</td><td><code>aarch64-darwin</code> and <code>x86_64-darwin</code>.</td></tr>
          <tr><td>License</td><td>MIT.</td></tr>
        </tbody>
      </Table>
      <p>Thanks to <a href="https://github.com/rohanp2051" target="_blank" rel="noopener noreferrer">@rohanp2051</a> for the initial Nix package.</p>

      <H2 id="run">Run it</H2>
      <p>You need Nix with flakes enabled. The command fetches the DMG, builds the package and starts the app.</p>
      <Steps>
        <Step title="Run the flake from Terminal." see="Nix downloads the DMG and unpacks it. SidebarFavorites Manager opens when that finishes.">
          <CodeBlock prompt lang="bash" label="Run SidebarFavorites with Nix" code="nix run github:ivg-design/SidebarFavorites" />
        </Step>
        <Step title="Add a favorite as usual." see="The manager window lists the favorite and Finder's sidebar shows its icon.">
          <p>From here the app behaves exactly as it does when you install the DMG. See <DocLink to="quick-start">Quick start</DocLink>.</p>
        </Step>
      </Steps>
      <p>The flake installs the pinned release. To get the latest release, install it with Homebrew or from the DMG instead. See <DocLink to="install">Install</DocLink>. If the app does not behave as expected, see <DocLink to="troubleshooting">Troubleshooting</DocLink>.</p>
    </>
  );
}
