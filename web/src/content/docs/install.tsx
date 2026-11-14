import type { DocMeta } from "./types";
import CodeBlock from "@/components/docs/CodeBlock";
import Table from "@/components/docs/Table";
import Figure from "@/components/docs/Figure";
import { Steps, Step } from "@/components/docs/Steps";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";
import { BREW_CMD, BREW_CASK_URL, RELEASES_URL } from "@/lib/config";

export const meta: DocMeta = {
  slug: "install",
  title: "Install",
  navTitle: "Install (Homebrew / DMG)",
  group: "Getting started",
  description: "This page shows the two ways to install SidebarFavorites: with Homebrew, or from the signed DMG on GitHub. Read it before your first launch; you need macOS 13.0 or later.",
  keywords: ["homebrew", "brew", "cask", "tap", "trust", "dmg", "download", "gatekeeper", "notarized", "ventura", "requirements"],
  excerpt: "Install from the official Homebrew Cask repository with one command, or download the DMG and drag SidebarFavorites Manager to Applications. Releases are Developer ID signed and notarized, and need macOS 13.0 or later.",
  sections: [
    { id: "choose", title: "Choose a method" },
    { id: "requirements", title: "Requirements" },
    { id: "homebrew", title: "Install with Homebrew" },
    { id: "migrate-from-tap", title: "Move from the old tap" },
    { id: "direct-download", title: "Install from the DMG" },
    { id: "first-launch", title: "What you see on first launch" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="choose">Choose a method</H2>
      <p>Both methods install the same signed app. The difference is who keeps it in your Applications folder.</p>
      <Table label="Installation methods">
        <thead><tr><th>Method</th><th>Choose it when</th></tr></thead>
        <tbody>
          <tr><td><a href="#homebrew">Homebrew</a></td><td>You already use Homebrew and want to install from the Terminal.</td></tr>
          <tr><td><a href="#direct-download">DMG from GitHub</a></td><td>You do not use Homebrew, or you prefer to drag the app into place yourself.</td></tr>
        </tbody>
      </Table>

      <H2 id="requirements">Requirements</H2>
      <Table label="System requirements">
        <thead><tr><th>Requirement</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Operating system</td><td>macOS 13.0 (Ventura) or later.</td></tr>
          <tr><td>Signing</td><td>Releases are Developer ID signed, notarized and stapled, so the app opens normally. There is no Gatekeeper detour and no <q>Open Anyway</q> step.</td></tr>
          <tr><td>Homebrew (Homebrew method only)</td><td>Homebrew itself, installed and working in the Terminal.</td></tr>
        </tbody>
      </Table>

      <H2 id="homebrew">Install with Homebrew</H2>
      <p>SidebarFavorites is available in the official <a href={BREW_CASK_URL}>Homebrew Cask repository</a> as <code>sidebarfavorites-manager</code>. No third-party tap or <code>brew trust</code> step is needed.</p>
      <Steps>
        <Step title="Run this command in Terminal." see={<>Homebrew downloads the app and places <strong>SidebarFavorites Manager</strong> in your Applications folder.</>}>
          <CodeBlock code={BREW_CMD} prompt lang="bash" label="Install the SidebarFavorites cask" />
        </Step>
        <Step title={<>Open <strong>SidebarFavorites Manager</strong> from the Applications folder.</>} see={<>The manager window opens. See <a href="#first-launch">What you see on first launch</a>.</>} />
      </Steps>

      <H2 id="migrate-from-tap">Move from the old tap</H2>
      <p>For an existing <code>sidebarfavorites</code> installation from <code>ivg-design/tap</code>, quit SidebarFavorites Manager and run these commands in order:</p>
      <CodeBlock code={`brew update\nbrew uninstall --cask ivg-design/tap/sidebarfavorites\n${BREW_CMD}`} lang="bash" label="Move to the official Homebrew cask" />
      <p>Use a regular uninstall, without <code>--zap</code>, to keep your saved favorites, custom icons and preferences.</p>

      <H2 id="direct-download">Install from the DMG</H2>
      <Steps>
        <Step title={<>Download the latest DMG from <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">Releases</a> on GitHub.</>} see="A DMG file is in your Downloads folder." />
        <Step title="Double-click the DMG." see="A disk image window opens with the app in it." />
        <Step title={<>Drag <strong>SidebarFavorites Manager</strong> to the Applications folder.</>} see="The app is copied into Applications." />
        <Step title="Open SidebarFavorites Manager from Applications." see={<>The manager window opens without any security prompt. See <a href="#first-launch">What you see on first launch</a>.</>} />
      </Steps>

      <H2 id="first-launch">What you see on first launch</H2>
      <p>The app opens the manager window and keeps an icon in the menu bar. With no favorites yet, the window reads <q>No Favorites</q> and offers an <strong>Add Favorite</strong> button.</p>
      <Figure shot="main-window-empty" alt="The manager window on first launch: the heading No Favorites, a line of explanation and an Add Favorite button" caption={<>The manager window on first launch. The footer shows the version of the app you installed.</>} />
      <p>You need the app only to add, change or remove a favorite. Quit it and the icons stay in Finder. Next, add your first favorite in the <DocLink to="quick-start">Quick start</DocLink>.</p>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Installation problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>Homebrew cannot find <code>sidebarfavorites-manager</code>.</td><td>Homebrew may have outdated package information.</td><td>Run <code>brew update</code>, then run <code>{BREW_CMD}</code> again.</td></tr>
          <tr><td>The app will not open.</td><td>The Mac runs a macOS older than 13.0, which the app does not support.</td><td>Update macOS to 13.0 or later.</td></tr>
          <tr><td>Anything else.</td><td>Varies.</td><td>See <DocLink to="troubleshooting">Troubleshooting</DocLink>.</td></tr>
        </tbody>
      </Table>
    </>
  );
}
