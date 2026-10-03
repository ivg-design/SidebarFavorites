import { nb } from "@/lib/nowrap";
import { Reveal } from "./motion/Reveal";
import Shot from "./Shot";
import CustomDemos from "./custom/CustomDemos";
import "../app/custom.css";

export default function CustomIcons() {
  return (
    <section id="custom" className="sec" aria-labelledby="custom-h">
      <div className="wrap cols cx-cols">
        <div className="cx-copy">
          <Reveal>
            <p className="eyebrow">Custom icons</p>
            <h2 id="custom-h" className="h2">{nb("Any SVG. Nothing to prepare.")}</h2>
            <p className="lede">{nb("A logo, an icon you drew, anything made of vector shapes. No SF Symbols template, no guide boxes, no naming field. The app flattens the file to a single outline and builds the symbol around it, compiled by the asset-catalog engine that ships with macOS, so no Xcode.")}</p>
          </Reveal>
          <Reveal delay={0.08} className="cx-demos"><CustomDemos /></Reveal>
          <p className="fine cx-fine">{nb("Sidebar icons are always monochrome: Finder draws a flat silhouette tinted to match the sidebar. That is a macOS rule, not a limit of this app.")}</p>
        </div>
        <Reveal delay={0.12} className="cx-shot">
          <Shot
            name="custom-svg-settings"
            alt="The app's Edit Favorite window in Custom SVG mode: a GitHub mark, the Size slider at 90 %, and the Preview with the enlarged icon and a mock sidebar row"
            caption="Edit Favorite in Custom SVG mode. The two demos mirror its Size slider and Preview."
          />
        </Reveal>
      </div>
    </section>
  );
}
