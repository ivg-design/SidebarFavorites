import type { ReactNode } from "react";
import Shot from "./Shot";
import { Reveal } from "./motion/Reveal";
import SymbolPlayground from "./how/SymbolPlayground";
import { nb } from "@/lib/nowrap";
import "@/app/how.css";

function Copy({ title, children, sticky, className = "" }: { title: string; children: ReactNode; sticky?: boolean; className?: string }) {
  return (
    <div className={`hw-copy${sticky ? " hw-sticky" : ""} ${className}`}>
      <Reveal>
        <h3 className="h3">{nb(title)}</h3>
        <div className="prose hw-prose">{children}</div>
      </Reveal>
    </div>
  );
}

/* The three-step quick start (README "Quick start"), told with the owner's captures at the one scale.
   Browse All… (SFSymbolBrowser) stays out: step 2's own capture shows the button, and #symbols is its section. */
export default function HowItWorks() {
  return (
    <section id="how-steps" className="sec" aria-labelledby="how-steps-h" data-testid="how">
      <h2 id="how-steps-h" className="sr-only">How it works, step by step</h2>
      <div className="wrap">
        <ol className="hw-steps">
          <li className="hw-step hw-s1" data-testid="how-step-1">
            <Copy title="Click +">
              <p>{nb("The manager window lists every favorite with its icon and an In Sidebar toggle. Press + or ⌘N to add one.")}</p>
            </Copy>
            <Shot name="SBFMainWindow" testId="how-shot-main" alt="The SidebarFavorites manager window listing folders, each with its icon and an In Sidebar toggle"
              caption={nb("The manager window.")} />
          </li>

          <li className="hw-step hw-s2" data-testid="how-step-2">
            <div className="hw-shot2">
              <Shot name="SBFAddFavoriteWindow" testId="how-shot-add" alt="The Add Favorite window: folder path, icon mode, SF Symbol name with quick picks, and a Preview of the sidebar row"
                caption={nb("The Add Favorite window is its own window. The Preview shows the glyph enlarged and at true sidebar size.")} />
            </div>
            <div className="hw-col2 hw-sticky">
              <Copy title="Pick the folder, choose the icon">
                <p>{nb("Choose the folder, or type a path (~ works). Local folders, iCloud Drive, Google Drive and the other cloud folders, mounted disks and network shares all count. The name follows the folder.")}</p>
                <p>{nb("Then the icon: an SF Symbol by name, a quick pick, Browse All… for about 8,300 more, or your own SVG. Try the name field below.")}</p>
              </Copy>
              <SymbolPlayground />
            </div>
          </li>

          <li className="hw-step hw-s3" data-testid="how-step-3">
            <Copy title="Add">
              <p>{nb("The app adds the row to Finder's sidebar and puts your icon on it.")}</p>
              <p>{nb("If Finder still shows the old icon, a banner offers Restart Finder. The app never restarts Finder on its own.")}</p>
            </Copy>
            <Shot name="example" testId="how-shot-example" alt="A real Finder sidebar with custom icons: Desktop, home, github, Mograph-work, Projects, Downloads, Applications, Documents"
              caption={nb("A real Finder sidebar, after Add.")} />
          </li>
        </ol>
      </div>
    </section>
  );
}
