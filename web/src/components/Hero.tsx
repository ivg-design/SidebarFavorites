import type { SiteRelease } from "@/lib/github";
import { BREW_CMD } from "@/lib/config";
import { nb } from "@/lib/nowrap";
import CopyButton from "./CopyButton";
import "@/app/hero.css";

/** Placeholder until the v2 hero lands (design lead owns this file). */
export default function Hero({ release }: { release: SiteRelease }) {
  return (
    <section id="top" className="hx sec" aria-labelledby="hero-title">
      <div className="wrap">
        <p className="eyebrow">{nb("For Finder · macOS 13+ · Free · MIT")}</p>
        <h1 id="hero-title" className="h1">Your sidebar, finally legible.</h1>
        <p className="lede">{nb("Finder gives every favorite the same grey folder. SidebarFavorites puts the icon you want on each one.")}</p>
        <div style={{ display: "flex", gap: "var(--s-4)", marginTop: "var(--s-6)", flexWrap: "wrap" }}>
          <a className="btn btn-primary btn-lg" href={release.dmgUrl}>Download for Mac</a>
          <CopyButton text={BREW_CMD} variant="chip" />
        </div>
      </div>
    </section>
  );
}
