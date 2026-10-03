"use client";
// The app's Size slider and Preview: an enlarged tile and a true-scale 16 pt sidebar row, next to a
// system row at 100 %. The glyph scales with transform only, so nothing reflows while dragging.
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { SideRow } from "./finder/Finder";
import { Glyph } from "./glyphs";
import "../app/custom.css";

export default function SizeToy({ glyph, label = "github" }: { glyph?: (px: number) => ReactNode; label?: string }) {
  const [v, setV] = useState(100);
  const id = useId();
  const k = { "--k": v / 100 } as CSSProperties;
  const draw = glyph ?? ((px: number) => <Glyph name="custom.github" size={px} strokeWidth={1.6} />);
  const onChange = (raw: number) => setV(Math.abs(raw - 100) <= 2 ? 100 : raw);
  return (
    <section aria-labelledby={`${id}-h`} className="cx-block">
      <h3 id={`${id}-h`} className="cx-h">Tune the size</h3>
      <div className="cx-sizebar">
        <label htmlFor={`${id}-r`}>Size</label>
        <output htmlFor={`${id}-r`} className="cx-read" data-testid="size-toy-read">{v} %</output>
        <button type="button" className="cx-reset" data-testid="size-toy-reset" onClick={() => setV(100)} disabled={v === 100}>Reset</button>
      </div>
      <input
        id={`${id}-r`} className="cx-range" data-testid="size-toy-range" type="range" min={50} max={150} step={1} value={v}
        aria-valuetext={`${v} percent`} onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="cx-scale" aria-hidden="true"><span>50%</span><span>100%</span><span>150%</span></div>
      <p className="cx-sub">Preview</p>
      <div className="cx-ship">
        <div className="cx-tile" aria-hidden="true">
          <span className="cx-big" style={k}>{draw(44)}</span>
        </div>
        <div className="cx-side">
          <SideRow selected icon={<span className="cx-live" data-testid="size-toy-live" style={k}>{draw(16)}</span>} label={label} />
          <SideRow icon={<Glyph name="arrow.down.circle" />} label="Downloads" />
          <span className="cx-dim">Downloads is a system symbol at 100 %</span>
        </div>
      </div>
      <p className="cx-note">Sidebar size: 16 pt, monochrome, tinted by macOS. A wide mark reads heavier than a sparse one at the same size — nudge it until it sits with the rest.</p>
      <p className="cx-note">Apply saves, rebuilds the icon and restarts Finder in one click, with the sheet open, so you can tune it against the real sidebar.</p>
    </section>
  );
}
