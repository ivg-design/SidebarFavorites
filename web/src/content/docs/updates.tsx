import type { DocMeta } from "./types";
import Figure from "@/components/docs/Figure";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";
import { asset } from "@/lib/config";

export const meta: DocMeta = {
  slug: "updates",
  title: "Updates",
  group: "Getting started",
  description: "How SidebarFavorites finds out about new releases: one request to GitHub per launch, and nothing installed behind your back.",
  keywords: ["update", "new version", "release", "download", "later", "notice", "privacy", "network", "check"],
  excerpt: "The app asks GitHub once per launch whether a newer release exists. Download opens the release page; Later dismisses it until the next launch.",
  sections: [
    { id: "the-notice", title: "The update notice" },
    { id: "what-the-check-does", title: "What the check does" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="the-notice">The update notice</H2>
      <p>The app asks GitHub once per launch whether a newer release exists, and tells you if there is one.</p>
      <Figure shot="SBFUpdateNotification" alt="The update notice with Download and Later buttons" caption="The update notice." max={440} />
      <p><strong>Download</strong> opens the release page. <strong>Later</strong> dismisses the notice until the next launch.</p>
      <H2 id="what-the-check-does">What the check does</H2>
      <p>That is the whole mechanism: one request at startup, no background checking, no automatic download, and nothing installed behind your back. If the check cannot reach GitHub it says nothing at all.</p>
      <p>Not sure what is new? Read the <a href={asset("/changelog")}>changelog</a>, or see <DocLink to="install">Install</DocLink> for how to get a release.</p>
    </>
  );
}
