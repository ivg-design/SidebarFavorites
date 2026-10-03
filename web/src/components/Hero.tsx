import { Download } from "lucide-react";
import type { SiteRelease } from "@/lib/github";
import { BREW_CMD } from "@/lib/config";
import { nb } from "@/lib/nowrap";
import CopyButton from "./CopyButton";
import HeroStage from "./hero/HeroStage";
import "@/app/hero.css";

const LINE1 = ["Your", "sidebar,"];
const LINE2 = ["finally", "legible."];

export default function Hero({ release }: { release: SiteRelease }) {
  return (
    <section id="top" className="hx" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hx-grid">
          <HeroStage />
          <div className="hx-copy">
            <p className="eyebrow">{nb("For Finder · macOS 13+ · Free · MIT")}</p>
            <h1 id="hero-title" className="display hx-h1" aria-label="Your sidebar, finally legible.">
              {LINE1.map((w, i) => (
                <span key={w}><span className="hx-w" aria-hidden="true" style={{ ["--i" as string]: i }}>{w}</span>{" "}</span>
              ))}
              <em>
                {LINE2.map((w, i) => (
                  <span key={w}><span className="hx-w" aria-hidden="true" style={{ ["--i" as string]: i + 2 }}>{w}</span>{i === 0 ? " " : ""}</span>
                ))}
              </em>
            </h1>
            <p className="hx-sub">
              {nb("Finder gives every favorite the same grey folder. SidebarFavorites puts the icon you want on each one — any of about 8,300 SF Symbols, or any SVG you own — so you find the folder before you read the name.")}
            </p>
            <div className="hx-cta">
              <a className="btn btn-coral" href={release.dmgUrl}>
                <Download size={20} aria-hidden="true" />
                Download for Mac
              </a>
              <CopyButton text={BREW_CMD} variant="chip" />
            </div>
            <p className="hx-fine">{nb("Nothing to enable in System Settings. Nothing runs in the background. Quit the app and the icons stay.")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
