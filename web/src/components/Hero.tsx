import { Download } from "lucide-react";
import type { SiteRelease } from "@/lib/github";
import { BREW_CMD } from "@/lib/config";
import FinderMock from "./FinderMock";
import CopyButton from "./CopyButton";

const LINE1 = ["Your", "sidebar,"];
const LINE2 = ["finally", "legible."];

export default function Hero({ release }: { release: SiteRelease }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hero-grid">
          <div className="hero-mock">
            <FinderMock />
          </div>
          <div className="hero-copy">
            <p className="eyebrow">For Finder · macOS 13+ · Free · MIT</p>
            <h1 id="hero-title" className="display" aria-label="Your sidebar, finally legible.">
              {LINE1.map((w, i) => (
                <span key={w}>
                  <span className="w" aria-hidden="true" style={{ ["--i" as string]: i }}>{w}</span>{i === 0 ? <><br className="brk" />{" "}</> : " "}
                </span>
              ))}
              <em>
                {LINE2.map((w, i) => (
                  <span key={w}>
                    <span className="w" aria-hidden="true" style={{ ["--i" as string]: i + 2 }}>{w}</span>{i === 0 ? " " : ""}
                  </span>
                ))}
              </em>
            </h1>
            <p className="hero-sub">
              Finder gives every favorite the same grey folder. SidebarFavorites puts the icon you want on each one — any of 8,300 SF Symbols, or any SVG you own — so you find the folder before you read the name.
            </p>
            <div className="hero-cta">
              <a className="btn btn-coral" href={release.dmgUrl}>
                <Download size={20} aria-hidden="true" />
                Download for Mac
              </a>
              <CopyButton text={BREW_CMD} variant="chip" />
            </div>
            <p className="hero-fine">Nothing to enable in System Settings. Nothing runs in the background. Quit the app and the icons stay.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
