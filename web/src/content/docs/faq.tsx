import type { DocMeta } from "./types";
import { H2, H3 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";
import { REPO_URL } from "@/lib/config";

export const meta: DocMeta = {
  slug: "faq",
  title: "FAQ",
  group: "Help",
  description: "Short answers to the questions people ask before and after installing SidebarFavorites, grouped by topic. Each answer says where to read more. If yours is not here, see Troubleshooting or report an issue.",
  keywords: ["faq", "questions", "background", "daemon", "login item", "color", "colour", "quit", "free", "license", "mit", "credits", "inspired", "sf symbols", "apple", "affiliated", "rknightuk", "rohanp2051", "xcode", "permissions", "full disk access", "reboot", "moved folder"],
  excerpt: "Does anything run in the background? No. Do I need Xcode, a permission or the app kept open? No. Can icons be coloured? No. Credits: inspired by rknightuk/custom-finder-sidebar-icons.",
  sections: [
    { id: "on-your-mac", title: "What the app does to your Mac" },
    { id: "icons", title: "Icons" },
    { id: "folders", title: "Folders" },
    { id: "project", title: "The project" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="on-your-mac">What the app does to your Mac</H2>
      <H3 id="background">Does anything run in the background?</H3>
      <p>No, not for a normal favorite. There is no extension, daemon, login item or launch agent. The one exception is <strong>Both icons</strong> mode, which adds one small Finder Sync helper (about 6 MB, no window) for each favorite you switch it on for. To see how a favorite is drawn without any process, read <DocLink to="how-it-works">How it works</DocLink>. To switch Both icons mode on or off, see <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>

      <H3 id="quit">Do I need to keep the app open?</H3>
      <p>No. You need the app only to add, edit or remove a favorite. Quit it and the icons stay. To quit, choose <strong>Quit SidebarFavorites</strong> from the menu bar menu.</p>

      <H3 id="survive">Do the icons survive a restart or a Finder restart?</H3>
      <p>Yes. The icons live in Finder&rsquo;s own sidebar list and in a registered helper bundle, so a reboot or a Finder restart does not remove them. If an icon change does not show up, Finder may need a restart. See <DocLink to="how-it-works" hash="finder-restarts">Finder restarts</DocLink>.</p>

      <H3 id="permissions">Does it need Full Disk Access or any other permission?</H3>
      <p>No. The app declares no entitlement and asks for no permission. If you use Both icons mode, its helpers appear in System Settings under their own <q>SBF-</q> names. See <DocLink to="keeping-both-icons" hash="helpers">Helpers and their status</DocLink>.</p>

      <H3 id="network">Does it connect to the internet?</H3>
      <p>Yes, once each time it opens: it asks GitHub whether a newer release exists. There is no checking in the background and no automatic download. To read more, or to update, see <DocLink to="updates">Updates</DocLink>.</p>

      <H3 id="rows">Will it change sidebar rows I added myself?</H3>
      <p>It puts an icon on them and nothing else. It does not rename them, move them or delete them. When you remove the favorite, the row stays and gets its original icon back. See <DocLink to="uninstalling">Uninstalling</DocLink> for what removal does.</p>

      <H2 id="icons">Icons</H2>
      <H3 id="color">Can I have a coloured icon?</H3>
      <p>No. Finder draws sidebar icons as a flat silhouette tinted to match the sidebar, so a coloured icon is not possible. That is a macOS rule, not a limit of this app. Choose an SF Symbol or import an SVG with a clear shape. See <DocLink to="custom-svg-icons">Custom SVG icons</DocLink>.</p>

      <H3 id="xcode">Do I need Xcode?</H3>
      <p>No. Custom icons are compiled by the asset-catalog engine that comes with macOS. You need Xcode only to build the app from source. See <DocLink to="building-from-source">Building from source</DocLink>.</p>

      <H3 id="own-icon">What if my folder already has an icon of its own?</H3>
      <p>The editor warns you and offers three choices for the folder&rsquo;s own icon. See <DocLink to="keeping-both-icons">Keeping both icons</DocLink>.</p>

      <H2 id="folders">Folders</H2>
      <H3 id="which-folders">Which folders work?</H3>
      <p>Local folders, iCloud Drive, folders under <code>~/Library/CloudStorage</code> (Google Drive, Dropbox, OneDrive and so on), and mounted disks and network shares. See <DocLink to="cloud-folders">Cloud folders</DocLink> and <DocLink to="disks-and-shares">Disks and network shares</DocLink>.</p>

      <H3 id="same-folder">Can two favorites use the same folder?</H3>
      <p>No. Two favorites would compete for the same sidebar row. The editor shows <q>already uses this folder</q> next to the folder field and does not allow the second one. Edit the existing favorite instead, or choose a different folder.</p>

      <H3 id="moved">What happens if I move or rename the folder?</H3>
      <p>The app keeps the folder path you chose. When it syncs and cannot find a folder at that path, it shows a warning that names the favorite and says its folder does not exist at the saved path, and it does not add a second row. To fix it, open the favorite in the manager window and choose the folder at its new location. See <DocLink to="troubleshooting">Troubleshooting</DocLink> if the icon is still missing.</p>

      <H2 id="project">The project</H2>
      <H3 id="license">What is the license?</H3>
      <p>MIT. The source is on <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>, where you can also <DocLink to="report-an-issue">report an issue</DocLink>.</p>

      <H3 id="credits">Who is credited?</H3>
      <p>SidebarFavorites is inspired by <a href="https://github.com/rknightuk/custom-finder-sidebar-icons" target="_blank" rel="noopener noreferrer">rknightuk/custom-finder-sidebar-icons</a> and uses Apple&rsquo;s SF Symbols. The Nix package comes from <a href="https://github.com/rohanp2051" target="_blank" rel="noopener noreferrer">@rohanp2051</a>. See <DocLink to="nix-flake">Nix flake</DocLink>.</p>

      <H3 id="trademarks">Is it affiliated with Apple?</H3>
      <p>No. SidebarFavorites is not affiliated with Apple Inc. SF Symbols is a trademark of Apple Inc.</p>
    </>
  );
}
