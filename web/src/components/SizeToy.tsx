"use client";
// The app's Preview panel: enlarged tile + a true-scale 16 pt sidebar row, driven by the Size slider.
// The glyph scales with transform only, so nothing reflows while dragging.
import { useId, useState, type CSSProperties } from "react";
import { SideRow } from "./finder/Finder";
import { Glyph } from "./glyphs";
import "../app/demos.css";

export default function SizeToy({ glyph = "custom.github", label = "github" }: { glyph?: string; label?: string }) {
  const [v, setV] = useState(100);
  const id = useId();
  const k = { "--k": v / 100 } as CSSProperties;
  const onChange = (raw: number) => setV(Math.abs(raw - 100) <= 2 ? 100 : raw);
  return (
    <div className="mac-win sz-card">
      <p className="sz-h">Preview</p>
      <div className="sz-top">
        <div className="sz-tilebox">
          <div className="sz-tile" aria-hidden="true"><span className="sz-big" style={k}><Glyph name={glyph} size={44} strokeWidth={1.6} /></span></div>
          <span className="sz-dim">Enlarged</span>
        </div>
        <div className="sz-rows" aria-hidden="true">
          <SideRow selected icon={<span className="sz-live" data-testid="size-toy-live" style={k}><Glyph name={glyph} /></span>} label={label} />
          <SideRow icon={<Glyph name="arrow.down.circle" />} label="Downloads" />
        </div>
      </div>
      <p className="sz-foot">Sidebar size: 16 pt tall, monochrome, tinted by macOS. A wide icon overhangs the column here because it does in Finder too. Downloads is a system symbol at 100 %.</p>
      <div>
        <div className="sz-sizebar">
          <label id={`${id}-t`} htmlFor={`${id}-r`}>Size</label>
          <span className="sz-read" aria-hidden="true">{v} %</span>
          <button type="button" className="sz-reset" data-testid="size-toy-reset" onClick={() => setV(100)} disabled={v === 100}>Reset</button>
        </div>
        <input
          id={`${id}-r`} className="sz-range" data-testid="size-toy-range" type="range" min={50} max={150} step={1} value={v}
          aria-valuetext={`${v} percent`} onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="sz-scale" aria-hidden="true"><span>50%</span><span>100%</span><span>150%</span></div>
      </div>
      <p className="sz-foot">100 % is exactly a system symbol&rsquo;s size. The right measurement, not always the right look.</p>
    </div>
  );
}
