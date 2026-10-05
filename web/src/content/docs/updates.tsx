import type { DocMeta } from "./types";
import Figure from "@/components/docs/Figure";
import Table from "@/components/docs/Table";
import { Steps, Step } from "@/components/docs/Steps";
import { H2 } from "@/components/docs/Headings";
import { RELEASES_URL } from "@/lib/config";

export const meta: DocMeta = {
  slug: "updates",
  title: "Updates",
  group: "Getting started",
  description: "This page explains how SidebarFavorites tells you that a newer release exists, what the update notice offers, and how to install the update. Read it if you want to know what the app sends over the network, or how to update.",
  keywords: ["update", "new version", "release", "download", "later", "notice", "privacy", "network", "check", "github"],
  excerpt: "The app asks GitHub once per launch whether a newer release exists. Download opens the release page; Later dismisses the notice. Nothing is downloaded or installed automatically.",
  sections: [
    { id: "the-check", title: "What the check is" },
    { id: "the-notice", title: "The update notice" },
    { id: "how-to-update", title: "How to update" },
    { id: "if-it-does-not-work", title: "If it does not work" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="the-check">What the check is</H2>
      <p>When the app starts, and after it has finished setting up your sidebar, it asks GitHub for the latest release of SidebarFavorites and compares its version number with the one you are running. That single request is the whole mechanism.</p>
      <Table label="What the update check does and does not do">
        <thead><tr><th>The app does</th><th>The app never does</th></tr></thead>
        <tbody>
          <tr><td>Sends one request to GitHub each time it launches.</td><td>Checks again while it is running, or in the background.</td></tr>
          <tr><td>Shows a notice when the latest release is newer than your version.</td><td>Downloads or installs anything by itself.</td></tr>
          <tr><td>Compares version numbers part by part, so a tenth minor release counts as newer than a ninth.</td><td>Shows a notice for a pre-release tag that is not a plain version number.</td></tr>
        </tbody>
      </Table>
      <p>The request is an anonymous read of GitHub&rsquo;s public releases information. It carries the app&rsquo;s name and version in its User-Agent header, as GitHub requires, and nothing else about you or your folders.</p>

      <H2 id="the-notice">The update notice</H2>
      <p>When a newer release exists, an alert titled <q>A new version is available</q> appears over the manager window. It names both versions: the release that is out and the one you have.</p>
      <Figure shot="alert-update" alt="An alert titled A new version is available, with a line naming the release that is out and the one you have, and the buttons Later and Download" caption={<>The notice names the new version and yours. Choose <strong>Download</strong> or <strong>Later</strong>.</>} />
      <Table label="Buttons in the update notice">
        <thead><tr><th>Button</th><th>What it does</th></tr></thead>
        <tbody>
          <tr><td><strong>Download</strong></td><td>Opens the release page on GitHub in your browser and closes the notice. The page lists the release&rsquo;s files, including the DMG.</td></tr>
          <tr><td><strong>Later</strong></td><td>Closes the notice. The app asks again the next time it launches.</td></tr>
        </tbody>
      </Table>

      <H2 id="how-to-update">How to update</H2>
      <p>The app does not replace itself. You install the new release the same way you installed the first one, and your favorites, settings and icons stay as they are because they live in the data folder, not in the app.</p>
      <Steps>
        <Step title={<>Click <strong>Download</strong> in the update notice.</>} see="The release page opens in your browser.">
          <p>You can also open <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">Releases</a> yourself at any time.</p>
        </Step>
        <Step title="Download the DMG from the release page." see="A DMG file is in your Downloads folder." />
        <Step title={<>Quit SidebarFavorites: choose <strong>Quit SidebarFavorites</strong> from its menu bar menu.</>} see="The app quits. The icons stay in Finder’s sidebar." />
        <Step title={<>Open the DMG and drag <strong>SidebarFavorites Manager</strong> to the Applications folder.</>} see={<>macOS asks whether to replace the existing app. Choose <strong>Replace</strong>.</>} />
        <Step title="Open SidebarFavorites Manager." see="The manager window lists your favorites unchanged, and the version in its footer is the one you installed." />
      </Steps>

      <H2 id="if-it-does-not-work">If it does not work</H2>
      <Table label="Update problems">
        <thead><tr><th>What you see</th><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>No notice appears, although a newer release exists.</td><td>The check could not reach GitHub, was rate limited, or got an answer it could not read. The app treats every such failure as <q>nothing to report</q> and shows no error.</td><td>Quit and open the app again with a working connection, or look at Releases yourself.</td></tr>
          <tr><td>The notice appears at every launch.</td><td>You chose <strong>Later</strong> or closed it, and the newer release is still not installed.</td><td>Install the release as described above.</td></tr>
        </tbody>
      </Table>
    </>
  );
}
