import { Eye, SlidersHorizontal, RefreshCw, TriangleAlert, Info } from "lucide-react";
import { asset } from "@/lib/config";
import { nb } from "@/lib/nowrap";
import { Reveal } from "./motion/Reveal";
import SizeToy from "./SizeToy";
import "../app/demos.css";

const BULLETS = [
  [Eye, "Live preview, enlarged and in a mock sidebar row at the real 16 pt"],
  [SlidersHorizontal, "Size slider 50–150 %: 100 % is a system symbol’s exact size, not always the right look"],
  [RefreshCw, "Apply saves, rebuilds and restarts Finder in one click, sheet stays open"],
  [TriangleAlert, "Tells you what it dropped: photos, un-outlined text, colour, hairlines — warnings, not rejections"],
] as const;

export default function CustomIcons() {
  const n = "custom-svg-settings";
  return (
    <section id="custom" className="sec">
      <div className="wrap ci2-grid">
        <div className="ci2-left">
        <Reveal className="ci2-copy">
          <p className="eyebrow">Custom icons</p>
          <h2 className="display h-sec">Any SVG. Nothing to prepare.</h2>
          <p className="lede">{nb("A logo, an icon you drew, anything made of vector shapes. No SF Symbols template, no guide boxes, no naming field. The app flattens the file to a single outline and builds the symbol around it — compiled by the asset-catalog engine that ships with macOS, so no Xcode.")}</p>
          <ul className="ci2-list">
            {BULLETS.map(([Icon, t]) => (
              <li key={t}><Icon size={20} aria-hidden="true" /><span>{nb(t)}</span></li>
            ))}
          </ul>
          <div className="ci2-callout">
            <Info size={18} aria-hidden="true" />
            <p>Sidebar icons are always monochrome. Finder draws a flat silhouette tinted to match the sidebar — that is a macOS rule, not a limit of this app. The preview shows the silhouette, so no surprises.</p>
          </div>
        </Reveal>
        <Reveal className="ci2-toy" delay={0.04}><SizeToy /></Reveal>
        </div>
        <Reveal className="ci2-side" delay={0.08}>
          <figure className="ci2-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(`/shots/${n}-w420.webp`)} srcSet={`${asset(`/shots/${n}-w420.webp`)} 420w, ${asset(`/shots/${n}-w840.webp`)} 840w`}
              sizes="(min-width:1024px) 480px, 100vw" width={420} height={714}
              alt="The app's Edit Favorite sheet with the Custom SVG type: a GitHub mark, the Size slider at 90 %, and the Preview showing the enlarged icon and a mock sidebar row"
              loading="lazy" decoding="async" />
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
