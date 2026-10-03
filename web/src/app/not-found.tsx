import type { Metadata } from "next";
import { Glyph } from "@/components/glyphs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { FolderGlyph, MacWindow, Pane, SideHeading, Sidebar, Vivid } from "@/components/finder/Finder";
import { asset, REPO_URL } from "@/lib/config";
import { nb } from "@/lib/nowrap";
import "./not-found.css";

export const metadata: Metadata = { title: "Not found" };

const ROWS = [
  { label: "Home", href: asset("/"), glyph: "house", ext: false },
  { label: "Docs", href: asset("/docs"), glyph: "book", ext: false },
  { label: "Changelog", href: asset("/changelog"), glyph: "clock.arrow.circlepath", ext: false },
  { label: "GitHub", href: REPO_URL, glyph: "custom.github", ext: true },
];

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="nf-main">
        <Vivid className="nf-panel">
          <MacWindow title="Not found" sideWidth={168}>
            <Sidebar>
              <SideHeading>Favorites</SideHeading>
              {ROWS.map(({ label, href, glyph, ext }) => (
                <a key={label} className="mac-row nf-row" href={href} data-testid={`nf-row-${label.toLowerCase()}`} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  <span className="ic"><Glyph name={glyph} size={16} /></span>
                  <span className="lab">{label}</span>
                </a>
              ))}
            </Sidebar>
            <Pane className="nf-pane">
              <div className="nf-tile">
                <FolderGlyph className="nf-folder" />
                <span className="nf-name">this page</span>
                <span className="nf-cap">Not in the sidebar.</span>
              </div>
            </Pane>
          </MacWindow>
        </Vivid>
        <div className="nf-copy">
          <h1 className="display nf-h1">Nothing here.</h1>
          <p>{nb("The page moved or never existed. The sidebar on the left still works.")}</p>
          <div className="nf-actions">
            <a className="btn btn-coral" href={asset("/")}>Back to the site</a>
            <a className="nf-link" href={asset("/docs")}>Read the docs</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
