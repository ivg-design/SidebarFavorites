import type { ReactNode } from "react";
import Shot from "./Shot";
import { Reveal } from "./motion/Reveal";
import SymbolPlayground from "./how/SymbolPlayground";
import { nb } from "@/lib/nowrap";
import "@/app/how.css";

function Copy({ n, title, children, sticky }: { n?: string; title: string; children: ReactNode; sticky?: boolean }) {
  return (
    <div className={`hw-copy${sticky ? " hw-sticky" : ""}`}>
      {n && <p className="eyebrow"><span className="eyebrow-n">{n}</span></p>}
      <h3 className="h3">{nb(title)}</h3>
      <div className="prose hw-prose">{children}</div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="how" className="sec" aria-labelledby="how-h" data-testid="how">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">How it works</p>
          <h2 className="h2" id="how-h">{nb("Pick a folder. Pick an icon. Add.")}</h2>
          <p className="lede">{nb("Three fields and a button. The name follows the folder, because Finder always labels a favorite with its real name, so you only ever choose the glyph.")}</p>
        </div>

        <ol className="hw-steps">
          <li className="hw-step" data-testid="how-step-1">
            <Reveal>
              <div className="cols">
                <Copy n="01" title="Click + and pick the folder">
                  <p>{nb("Browse, or type a path (~ works). Local folders, iCloud Drive, ~/Library/CloudStorage (Google Drive, Dropbox, OneDrive…), mounted disks and network shares all count.")}</p>
                </Copy>
                <Shot name="SBFMainWindow" alt="The SidebarFavorites manager window listing folders, each with its icon and an In Sidebar toggle"
                  caption={nb("The manager window. + adds a favorite, or press ⌘N.")} />
              </div>
            </Reveal>
          </li>

          <li className="hw-step" data-testid="how-step-2">
            <Reveal>
              <div className="cols cols-rev">
                <Copy n="02" title="Choose the icon" sticky>
                  <p>{nb("Type an SF Symbol name like hammer.fill or star.circle, click a quick pick, or Browse All… to search every symbol this Mac can draw (about 8,300) by name or keyword, so “bin” finds trash. Or Import SVG… for your own artwork.")}</p>
                  <SymbolPlayground />
                </Copy>
                <Shot name="SBFAddFavoriteWindow" alt="The Add Favorite window: folder path, icon mode, SF Symbol name with quick picks, and a Preview of the sidebar row"
                  caption={nb("The Add Favorite window. The Preview shows the glyph enlarged and at true sidebar size.")} />
              </div>
            </Reveal>
            <Reveal>
              <div className="cols hw-sub">
                <Copy title="Browse All…">
                  <p>{nb("Search the whole catalog, not just the quick picks. Names and keywords both match.")}</p>
                </Copy>
                <Shot name="SFSymbolBrowser" alt="The SF Symbols browser: a search field above a grid of symbols"
                  caption={nb("Browse All… lists every SF Symbol this Mac can draw.")} />
              </div>
            </Reveal>
          </li>

          <li className="hw-step" data-testid="how-step-3">
            <Reveal>
              <div className="cols cols-rev">
                <Copy n="03" title="Add">
                  <p>{nb("The folder appears in Finder's sidebar with your icon. If Finder still shows an old one, a banner offers Restart Finder. The app never restarts Finder on its own.")}</p>
                </Copy>
                <Shot name="example" alt="A real Finder sidebar with custom icons: Desktop, home, github, Mograph-work, Projects, Downloads, Applications, Documents"
                  caption={nb("A real Finder sidebar, after Add.")} />
              </div>
            </Reveal>
          </li>
        </ol>
      </div>
    </section>
  );
}
