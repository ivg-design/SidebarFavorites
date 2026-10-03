import { nb } from "@/lib/nowrap";
import { Reveal } from "./motion/Reveal";
import Shot from "./Shot";
import CustomDemos from "./custom/CustomDemos";
import "../app/custom.css";

export default function CustomIcons() {
  return (
    <section id="custom" className="sec" aria-labelledby="custom-h">
      <div className="wrap">
        <Reveal className="cx-head">
          <h2 id="custom-h" className="h2">{nb("Any SVG. Nothing to prepare.")}</h2>
          <p className="lede">{nb("No SF Symbols template to export, no guide boxes to draw inside, no naming field to get right. The app flattens the file to one outline and builds the symbol around it. You see the exact silhouette, enlarged and at the real 16 pt, before anything ships. Try it with your own file.")}</p>
        </Reveal>
        <div className="cx-stage">
          <div className="cx-left">
            <CustomDemos />
        <p className="fine cx-fine">{nb("Sidebar icons are always monochrome: Finder draws a flat silhouette tinted to match the sidebar. That is a macOS rule, not a limit of this app. Custom icons are compiled by the asset-catalog engine that ships with macOS, so no Xcode.")}</p>
          </div>
          <div className="cx-lane">
            <Shot
              name="svg-import"
              alt="The app's Add Favorite window in Custom SVG mode: an Import SVG… button and an empty Preview with a dashed placeholder tile"
              caption="Add Favorite, Custom SVG: Import SVG… and an empty Preview, waiting for a file."
            />
            <Shot
              name="custom-svg-settings"
              crop={{ y: 850, h: 820 }}
              cropLabel="the Size slider and the Preview"
              alt="The app's Edit Favorite window with a GitHub mark: the Size slider at 90 percent, and the Preview with the enlarged icon and a mock sidebar row"
              caption="Size runs 50 to 150 %, and the preview follows as you drag. The slider below the demo does the same."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
