import type { DocMeta } from "./types";
import { H2, H3 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";
import { REPO_URL } from "@/lib/config";

export const meta: DocMeta = {
  slug: "faq",
  title: "FAQ",
  group: "Help",
  description: "Short answers: background processes, colour icons, quitting the app, updates, which folders work, and credits.",
  keywords: ["faq", "questions", "background", "daemon", "login item", "color", "colour", "quit", "free", "license", "mit", "credits", "inspired", "sf symbols", "apple", "affiliated", "rknightuk", "rohanp2051"],
  excerpt: "Does anything run in the background? No. Can icons be coloured? No. Credits: inspired by rknightuk/custom-finder-sidebar-icons.",
  sections: [
    { id: "background", title: "Does anything run in the background?" },
    { id: "color", title: "Can I have a coloured icon?" },
    { id: "quit", title: "Do I need to keep the app open?" },
    { id: "rows", title: "Will it touch sidebar rows I added myself?" },
    { id: "which-folders", title: "Which folders work?" },
    { id: "network", title: "Does it phone home?" },
    { id: "license", title: "What is the license?" },
    { id: "credits", title: "Credits" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="background">Does anything run in the background?</H2>
      <p>No, not for a normal favorite: no extension, no daemon, no login item, no launch agent. The one exception is <strong>Both icons</strong> mode, which adds one small Finder Sync helper (about 6 MB, no window) for each favorite you turn it on for. See <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>
      <H2 id="color">Can I have a coloured icon?</H2>
      <p>No. Finder draws sidebar icons as a flat silhouette tinted to match the sidebar. That is a macOS rule, not a limitation of this app.</p>
      <H2 id="quit">Do I need to keep the app open?</H2>
      <p>No. The app is only needed when you want to add, edit or remove a favorite. Quit it and the icons stay. They survive reboots and Finder restarts on their own.</p>
      <H2 id="rows">Will it touch sidebar rows I added myself?</H2>
      <p>It only puts an icon on them. Rows you added yourself are left where they are, and removing the favorite restores the original icon rather than deleting the row.</p>
      <H2 id="which-folders">Which folders work?</H2>
      <p>Local folders, iCloud Drive, <code>~/Library/CloudStorage</code> (Google Drive, Dropbox, OneDrive and so on), and mounted disks and network shares. See <DocLink to="cloud-folders">Cloud folders</DocLink> and <DocLink to="disks-and-shares">Disks and network shares</DocLink>.</p>
      <H2 id="network">Does it phone home?</H2>
      <p>The app makes one request to GitHub per launch to check for a newer release. There is no background checking and no automatic download. See <DocLink to="updates">Updates</DocLink>.</p>
      <H2 id="license">What is the license?</H2>
      <p>MIT. The source is on <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
      <H2 id="credits">Credits</H2>
      <ul>
        <li>Inspired by <a href="https://github.com/rknightuk/custom-finder-sidebar-icons" target="_blank" rel="noopener noreferrer">rknightuk/custom-finder-sidebar-icons</a>.</li>
        <li>Uses Apple&rsquo;s SF Symbols.</li>
        <li>The Nix package comes from <a href="https://github.com/rohanp2051" target="_blank" rel="noopener noreferrer">@rohanp2051</a>. Thank you.</li>
      </ul>
      <H3 id="trademarks">Trademarks</H3>
      <p>SidebarFavorites is not affiliated with Apple Inc. SF Symbols is a trademark of Apple Inc.</p>
    </>
  );
}
