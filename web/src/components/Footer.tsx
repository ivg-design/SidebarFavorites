import Image from "next/image";
import { asset, ISSUES_URL, REPO_URL, RELEASES_URL } from "@/lib/config";
import { nb } from "@/lib/nowrap";
import "@/app/footer.css";

const links: [string, string, boolean?][] = [
  ["Docs", "/docs"],
  ["Changelog", "/changelog"],
  ["GitHub", REPO_URL, true],
  ["Releases", RELEASES_URL, true],
  ["Issues", ISSUES_URL, true],
  ["MIT license", `${REPO_URL}/blob/main/LICENSE`, true],
];

export default function Footer() {
  return (
    <footer className="foot" data-testid="footer">
      <div className="wrap foot-in">
        <a className="foot-brand" href={asset("/")} aria-label="SidebarFavorites, home" data-testid="footer-home">
          <Image src={asset("/images/icon-64.png")} alt="" width={56} height={56} />
        </a>
        <nav className="foot-links" aria-label="Footer">
          {links.map(([l, h, ext]) => ext
            ? <a key={l} href={h} target="_blank" rel="noopener noreferrer">{nb(l)}<span className="sr-only"> (opens in a new tab)</span></a>
            : <a key={l} href={asset(h)}>{nb(l)}</a>)}
        </nav>
        <p className="fine foot-fine"><span>{nb("Finder sidebar icons for macOS, by IVG Design.")}</span> <span>{nb("© 2026 IVG Design")}</span></p>
      </div>
    </footer>
  );
}
