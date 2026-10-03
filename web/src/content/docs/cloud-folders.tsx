import type { DocMeta } from "./types";
import { H2 } from "@/components/docs/Headings";
import DocLink from "@/components/docs/DocLink";

export const meta: DocMeta = {
  slug: "cloud-folders",
  title: "Cloud folders",
  group: "Guides",
  description: "iCloud Drive and CloudStorage folders (Google Drive, Dropbox, OneDrive) work exactly like local folders.",
  keywords: ["icloud", "icloud drive", "cloudstorage", "google drive", "dropbox", "onedrive", "fileprovider", "symlink"],
  excerpt: "Folders in iCloud Drive and ~/Library/CloudStorage work exactly like local ones. This did not work in any version before 1.0.",
  sections: [
    { id: "works-like-local", title: "Works like a local folder" },
    { id: "why-not-before", title: "Why it did not work before 1.0" },
    { id: "old-symlink", title: "The old symlink workaround" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="works-like-local">Works like a local folder</H2>
      <p>Folders in iCloud Drive and <code>~/Library/CloudStorage</code> (Google Drive, Dropbox, OneDrive and the like) work exactly like local ones. Add one the usual way: pick the folder, pick the icon, <strong>Add</strong>.</p>
      <H2 id="why-not-before">Why it did not work before 1.0</H2>
      <p>This did not work in any version before 1.0. Those paths are virtual FileProvider mounts that Finder Sync extensions cannot see, and the old mechanism depended on such an extension. The current mechanism sets an icon on the sidebar row itself instead (see <DocLink to="how-it-works">How it works</DocLink>).</p>
      <H2 id="old-symlink">The old symlink workaround</H2>
      <p>The symlink workaround the old README described is no longer needed. If you set one up, the favorite pointing at it keeps working, and you can also just point it at the real folder now.</p>
    </>
  );
}
