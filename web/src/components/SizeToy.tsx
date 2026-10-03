"use client";
// OWNER: worker D. Draggable 50-150% size slider updating a sidebar-row preview live.
// The glyph scales with transform only, so no layout changes while dragging.
import { useId, useState } from "react";
import { Glyph } from "./glyphs";
import s from "./SizeToy.module.css";

export default function SizeToy({ glyph = "arrow.triangle.branch", label = "github" }: { glyph?: string; label?: string }) {
  const [v, setV] = useState(100);
  const id = useId();
  const onChange = (raw: number) => setV(Math.abs(raw - 100) <= 2 ? 100 : raw);
  return (
    <div className={s.toy}>
      <div className={s.head}><b id={`${id}-t`}>Try the size slider</b></div>
      <p className={s.cap}>Drag to resize the glyph in a real 16 pt sidebar row; 100 % is a system symbol&rsquo;s exact size. A wide or busy mark reads heavier than a sparse one.</p>
      <div className={s.body}>
        <div className={s.rows} aria-hidden="true">
          <div className={s.row} data-live="true">
            <span className={s.ic}><span className={s.live} data-testid="size-toy-live" style={{ ["--k" as string]: v / 100, display: "grid" }}><Glyph name={glyph} size={16} /></span></span>
            {label}
            <span className={s.tag}>{v} %</span>
          </div>
          <div className={s.row}>
            <span className={s.ic}><Glyph name={glyph} size={16} /></span>
            {label}
            <span className={s.tag}>100 %</span>
          </div>
        </div>
        <div className={s.ctl}>
          <input
            className={s.range}
            data-testid="size-toy-range" type="range" min={50} max={150} step={1} value={v}
            aria-labelledby={`${id}-t`} aria-valuetext={`${v} percent`}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <div className={s.scale} aria-hidden="true"><span>50%</span><span>100%</span><span>150%</span></div>
          <div className={s.foot}>
            <span className={s.read} aria-live="off">Size {v} %</span>
            <button type="button" className={s.reset} data-testid="size-toy-reset" onClick={() => setV(100)} disabled={v === 100}>Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}
