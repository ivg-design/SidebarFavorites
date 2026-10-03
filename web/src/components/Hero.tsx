import type { SiteRelease } from "@/lib/github";
import { BREW_CMD } from "@/lib/config";
import HeroStage from "./hero/HeroStage";
import "@/app/hero.css";

/** Hero v3: the page opens inside Finder's sidebar at poster scale (see hero/HeroStage). The section is the scroll range. */
export default function Hero({ release }: { release: SiteRelease }) {
  return (
    <section id="top" className="hx" aria-labelledby="hero-title-h1">
      <HeroStage dmgUrl={release.dmgUrl} brew={BREW_CMD} />
    </section>
  );
}
