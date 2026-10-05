import type { DocMeta } from "./types";
import Callout from "@/components/docs/Callout";
import Table from "@/components/docs/Table";
import Figure from "@/components/docs/Figure";
import { Steps, Step } from "@/components/docs/Steps";
import { MenuPath } from "@/components/docs/Inline";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";
import { ISSUES_URL } from "@/lib/config";

export const meta: DocMeta = {
  slug: "report-an-issue",
  title: "Report an issue",
  group: "Help",
  description: "How to report a bug or ask for a feature on GitHub so that it can be reproduced. Use it when Troubleshooting and the FAQ did not solve your problem. It lists what to check first, what to include, and what to keep private.",
  keywords: ["bug", "issue", "github", "feature request", "support", "report", "contact", "feedback"],
  excerpt: "Open an issue on GitHub with your macOS version, the app version and what you expected to happen.",
  sections: [
    { id: "where", title: "Before you report" },
    { id: "include", title: "What to include" },
    { id: "how", title: "How to file it" },
    { id: "private", title: "What not to attach" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="where">Before you report</H2>
      <p>Bugs and feature requests go to the <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">GitHub issue tracker</a>. You need a free GitHub account. Check these two pages first, because they answer the common cases and can save you the wait:</p>
      <Table label="Pages to check first">
        <thead><tr><th>Page</th><th>Check it when</th></tr></thead>
        <tbody>
          <tr><td><DocLink to="troubleshooting">Troubleshooting</DocLink></td><td>An icon is missing, wrong, or does not update, or an SVG shows warnings.</td></tr>
          <tr><td><DocLink to="faq">FAQ</DocLink></td><td>You are not sure whether the app can do something, or what it changes on your Mac.</td></tr>
        </tbody>
      </Table>

      <H2 id="include">What to include</H2>
      <p>A report that names the versions and the steps can be reproduced. Add one item for each row below that applies to your problem.</p>
      <Table label="What to include in a report">
        <thead><tr><th>Include</th><th>Where to find it</th></tr></thead>
        <tbody>
          <tr><td>The app version.</td><td>In the footer of the manager window, in the menu bar menu, or in <strong>Version</strong> under <strong>About</strong> in the Settings window. It looks like <q>1.2.0 (47)</q>.</td></tr>
          <tr><td>The macOS version.</td><td><MenuPath items={["Apple menu", "About This Mac"]} /></td></tr>
          <tr><td>What you did.</td><td>Your own notes. List the steps in order, starting from the manager window.</td></tr>
          <tr><td>What you expected.</td><td>Your own notes. One sentence is enough.</td></tr>
          <tr><td>What happened instead.</td><td>Your own notes, plus a screenshot of the sidebar or the window if it helps.</td></tr>
          <tr><td>Whether the favorite uses <strong>Both icons</strong> mode.</td><td>In the favorite editor, under the icon mode choice. See <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</td></tr>
          <tr><td>The state of the favorite&rsquo;s helper.</td><td>Under <strong>Finder Sync Helpers</strong> in the Settings window, as the line shown beside the favorite&rsquo;s <code>SBF-</code> name.</td></tr>
          <tr><td>The warnings for an SVG.</td><td>In the import sheet and the editor. Copy the text as shown. Attach the SVG too if you can share it.</td></tr>
          <tr><td>A configuration issue.</td><td>A <strong>Configuration Issue</strong> notice in Settings. Say that it appeared. The unreadable file is kept as <code>config.corrupt-&lt;timestamp&gt;.json</code> next to the original. See <DocLink to="config-json" hash="if-unreadable">If the file cannot be read</DocLink>.</td></tr>
        </tbody>
      </Table>
      <Figure shot="settings-helpers" alt="The Settings window with Version under About and a Finder Sync Helpers group listing one helper with an Enabled status" caption={<>Look at <strong>Version</strong> under <strong>About</strong> for the app version, and at <strong>Finder Sync Helpers</strong> for the status of each helper.</>} />

      <H2 id="how">How to file it</H2>
      <Steps>
        <Step title={<>Open the <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">issue tracker</a> and sign in to GitHub.</>} see="The list of open issues for SidebarFavorites." />
        <Step title="Search the list for your problem." see="Either an issue that matches yours, or no result. If one matches, add your details to it instead of opening another.">
          <p>One issue with several reports is easier to fix than several copies of the same one.</p>
        </Step>
        <Step title={<>Click <strong>New issue</strong>.</>} see="GitHub shows the form for a new issue." />
        <Step title="Write a short title that names the problem, then fill in the details from the table above." />
        <Step title={<>Click <strong>Submit new issue</strong>.</>} see="The issue is published with its own number, and GitHub emails you when someone replies." />
      </Steps>

      <H2 id="private">What not to attach</H2>
      <p>GitHub issues are public. Look at anything you attach before you submit it.</p>
      <Callout kind="warn">Do not attach a <code>config.json</code> or a screenshot that shows folder names or paths you do not want public. The file lists the path of every favorite. Copy only the lines that matter and replace private names, or describe the setup in words.</Callout>
    </>
  );
}
