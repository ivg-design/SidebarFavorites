import Image from "next/image";
import { asset, ISSUES_URL, REPO_URL } from "@/lib/config";
import { nb } from "@/lib/nowrap";

const cols: { h: string; links: [string, string, boolean?][] }[] = [
  { h: "Product", links: [["How it works", "/#how"], ["Custom icons", "/#custom"], ["Everywhere", "/#everywhere"], ["Both icons", "/#both"], ["Under the hood", "/#hood"], ["Install", "/#install"], ["Changelog", "/changelog"]] },
  { h: "Help", links: [["Quick start", "/docs"], ["Cloud folders", "/docs/cloud-folders"], ["Disks and shares", "/docs/disks-and-shares"], ["Uninstalling", "/docs/uninstalling"], ["Building from source", "/docs/building-from-source"], ["Nix flake", "/docs/nix-flake"]] },
  { h: "Resources", links: [["GitHub", REPO_URL, true], ["Report an issue", ISSUES_URL, true], ["Credits", "/docs/faq#credits"]] },
  { h: "More from Forge", links: [["Forge hub", "https://forge.mograph.life/", true], ["WebWatcher", "https://forge.mograph.life/", true], ["Herald", "https://forge.mograph.life/", true], ["RAV", "https://forge.mograph.life/apps/rav/", true], ["LERP", "https://forge.mograph.life/apps/lerp/", true], ["fNav+", "https://forge.mograph.life/", true]] },
];

export default function Footer() {
  return (
    <footer className="foot shell-foot">
      <div className="wrap foot-grid">
        <div className="foot-brand">
          <Image src={asset("/images/icon-64.png")} alt="" width={40} height={40} />
          <b>SidebarFavorites</b>
          <p>{nb("Finder sidebar icons for macOS, by IVG Design. MIT license.")}</p>
          <p>{nb("© 2026 IVG Design")}</p>
        </div>
        <div className="foot-links">
          {cols.map((c) => (
            <nav key={c.h} aria-label={c.h}>
              <h4>{c.h}</h4>
              <ul>
                {c.links.map(([l, h, ext]) => (
                  <li key={l}>
                    {ext ? <a href={h} target="_blank" rel="noopener noreferrer">{nb(l)}</a> : <a href={asset(h)}>{nb(l)}</a>}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
