import type { DocMeta } from "./types";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";
import { ISSUES_URL } from "@/lib/config";

export const meta: DocMeta = {
  slug: "report-an-issue",
  title: "Report an issue",
  group: "Help",
  description: "Found a bug or have a request? Open an issue on GitHub, and include these few details so it can be reproduced.",
  keywords: ["bug", "issue", "github", "feature request", "support", "report", "contact", "feedback"],
  excerpt: "Open an issue on GitHub with your macOS version, the app version and what you expected to happen.",
  sections: [
    { id: "where", title: "Where to report" },
    { id: "include", title: "What to include" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="where">Where to report</H2>
      <p>Bugs and requests go to the <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">GitHub issue tracker</a>. Check <DocLink to="troubleshooting">Troubleshooting</DocLink> and the <DocLink to="faq">FAQ</DocLink> first: the common cases are answered there.</p>
      <H2 id="include">What to include</H2>
      <ul>
        <li>Your macOS version, and the app version (shown in the menu bar menu and in the main window footer).</li>
        <li>What you did, what you expected, and what happened instead.</li>
        <li>Whether the favorite uses <strong>Both icons</strong> mode, and what Settings shows for its helper.</li>
        <li>Any warnings the app showed for an SVG, and the SVG itself if you can share it.</li>
        <li>If the app reported a configuration issue, mention it. The unreadable file is kept next to the original as <code>config.corrupt-&lt;timestamp&gt;.json</code>.</li>
      </ul>
    </>
  );
}
