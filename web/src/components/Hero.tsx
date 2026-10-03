import { Download } from "lucide-react";
import type { SiteRelease } from "@/lib/github";
import { BREW_CMD } from "@/lib/config";
import { nb } from "@/lib/nowrap";
import CopyButton from "./CopyButton";
import HeroStage from "./hero/HeroStage";
import "@/app/hero.css";

/** Hero: the headline at full width, then one faithful Finder window doing the product's one move. */
export default function Hero({ release }: { release: SiteRelease }) {
  return (
    <section id="top" className="hx" aria-labelledby="hero-title-h1">
      <div className="wrap hx-head">
        <div className="hx-lead">
          <p className="eyebrow">{nb("For Finder · macOS 13+ · Free · MIT")}</p>
          <h1 id="hero-title-h1" className="h1 hx-h1">Your sidebar, finally&nbsp;legible.</h1>
        </div>
        <div className="hx-aside">
          <p className="lede hx-lede">
            {nb("Finder gives every favorite the same grey folder. SidebarFavorites puts the icon you want on each one — any of about 8,300 SF Symbols, or any SVG you own — so you find the folder before you read the name.")}
          </p>
          <div className="hx-cta">
            <a className="btn btn-primary btn-lg" href={release.dmgUrl} data-testid="hero-dmg">
              <Download size={20} aria-hidden="true" />
              Download for Mac
            </a>
            <CopyButton text={BREW_CMD} variant="chip" />
          </div>
          <p className="fine hx-fine">{nb("Nothing to enable in System Settings. Nothing runs in the background. Quit the app and the icons stay.")}</p>
        </div>
      </div>
      <div className="hx-band vivid">
        <div className="wrap"><HeroStage /></div>
      </div>
    </section>
  );
}
