import { Eye, SlidersHorizontal, RefreshCw, TriangleAlert, Info } from "lucide-react";
import { asset } from "@/lib/config";
import { Reveal } from "./motion/Reveal";
import SizeToy from "./SizeToy";

const BULLETS = [
  [Eye, "Live preview, enlarged and in a mock sidebar row at the real 16 pt"],
  [SlidersHorizontal, "Size slider 50–150 %: 100 % is a system symbol’s exact size, not always the right look"],
  [RefreshCw, "Apply saves, rebuilds and restarts Finder in one click, sheet stays open"],
  [TriangleAlert, "Tells you what it dropped: photos, un-outlined text, colour, hairlines — warnings, not rejections"],
] as const;

function Shot({ name, alt }: { name: string; alt: string }) {
  return (
    <div className="tall">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset(`/shots/${name}-w420.webp`)} srcSet={`${asset(`/shots/${name}-w420.webp`)} 420w, ${asset(`/shots/${name}-w840.webp`)} 840w`}
        sizes="(min-width:1024px) 320px, 45vw" width={320} height={440} alt={alt} loading="lazy" decoding="async" />
    </div>
  );
}

export default function CustomIcons() {
  return (
    <section id="custom" className="sec">
      <div className="wrap ci-grid">
        <Reveal className="ci-copy">
          <p className="eyebrow">Custom icons</p>
          <h2 className="display h-sec">Any SVG. Nothing to prepare.</h2>
          <p className="lede">A logo, an icon you drew, anything made of vector shapes. No SF Symbols template, no guide boxes, no naming field. The app flattens the file to a single outline and builds the symbol around it — compiled by the asset-catalog engine that ships with macOS, so no Xcode.</p>
          <ul className="ci-list">
            {BULLETS.map(([Icon, t]) => (
              <li key={t}><Icon size={20} aria-hidden="true" /><span>{t}</span></li>
            ))}
          </ul>
          <div className="callout">
            <Info size={18} aria-hidden="true" />
            <p>Sidebar icons are always monochrome. Finder draws a flat silhouette tinted to match the sidebar — that is a macOS rule, not a limit of this app. The preview shows the silhouette, so no surprises.</p>
          </div>
        </Reveal>
        <Reveal className="ci-side" delay={0.08}>
          <div className="ci-shots">
            <Shot name="svg-import" alt="Add Favorite sheet with the Custom SVG type and an Import SVG button, previewing the imported icon" />
            <Shot name="custom-svg-settings" alt="Custom SVG settings showing the size slider and the enlarged preview in a mock sidebar row" />
          </div>
          <SizeToy />
        </Reveal>
      </div>
    </section>
  );
}
