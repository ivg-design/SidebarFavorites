// OWNER: worker D. SoftwareApplication + Organization + WebSite JSON-LD, rendered in the landing page.
import type { SiteRelease } from "@/lib/github";
import { REPO_URL } from "@/lib/config";
import { toCanonicalUrl } from "@/lib/seo";

const ORG_ID = "https://forge.mograph.life/#organization";

export default function StructuredData({ release }: { release: SiteRelease }) {
  const home = toCanonicalUrl("/");
  const mb = parseInt(release.sizeLabel, 10);
  const graph = [
    {
      "@type": "SoftwareApplication",
      "@id": `${home}#app`,
      name: "SidebarFavorites",
      description: "Give the folders in Finder's sidebar the icons you want. Any SF Symbol or your own SVG, no extension, no daemon, no login item.",
      url: home,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "macOS 13.0 or later",
      softwareVersion: release.version,
      downloadUrl: release.dmgUrl,
      ...(Number.isFinite(mb) ? { fileSize: `${mb} MB` } : {}),
      ...(release.date ? { datePublished: release.date } : {}),
      license: "https://opensource.org/licenses/MIT",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: { "@type": "Organization", "@id": ORG_ID, name: "IVG Design", url: "https://forge.mograph.life" },
      codeRepository: REPO_URL,
      image: toCanonicalUrl("/images/icon-512.png"),
      screenshot: [
        toCanonicalUrl("/shots/SBFMainWindow-w860.webp"),
        toCanonicalUrl("/shots/SBFAddFavoriteWindow-w960.webp"),
        toCanonicalUrl("/shots/SBFTaskbarPopOver-w584.webp"),
      ],
      featureList: [
        "Custom icons for Finder sidebar favorites from any SF Symbol or your own SVG",
        "Works for local folders, iCloud Drive, cloud storage folders, mounted disks and network shares",
        "Nothing to enable in System Settings and nothing running in the background",
        "Icons survive reboots and Finder restarts",
        "Keep a folder's own icon and a sidebar glyph together (opt-in per favorite)",
        "Live preview and a 50-150% size slider",
        "No Xcode required",
        "Free and open source (MIT)",
      ],
    },
    { "@type": "Organization", "@id": ORG_ID, name: "IVG Design", url: "https://forge.mograph.life" },
    { "@type": "WebSite", "@id": `${home}#website`, name: "SidebarFavorites", url: home, publisher: { "@id": ORG_ID } },
  ];
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
