"use client";
// The two demos share one dark panel styled like the app's Preview panel; the chosen mark feeds both.
import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { SideRow } from "../finder/Finder";
import SizeToy from "../SizeToy";
import { MARKS, MarkSvg, type MarkId } from "./marks";

export default function CustomDemos() {
  const [id, setId] = useState<MarkId>("a");
  const mark = MARKS.find((m) => m.id === id)!;
  return (
    <div className="cx-panel" data-testid="cx-panel">
      <section aria-labelledby="cx-drop-h" className="cx-block">
        <h3 id="cx-drop-h" className="cx-h">Drop in a mark</h3>
        <div className="cx-marks" role="group" aria-label="Sample marks">
          {MARKS.map((m) => (
            <button
              key={m.id} type="button" className="cx-mark" aria-pressed={m.id === id}
              data-testid={`cx-mark-${m.id}`} onClick={() => setId(m.id)}
            >
              <span className="cx-mark-art"><MarkSvg id={m.id} size={32} /></span>
              <span className="cx-mark-txt"><b>{m.name}</b><i>{m.kind}</i></span>
            </button>
          ))}
        </div>
        <div className="cx-out" aria-live="polite">
          <p className="cx-sub">What the app ships</p>
          <div className="cx-ship">
            <div className="cx-tile" data-testid="cx-silhouette" data-mark={mark.id} role="img" aria-label={`${mark.name}: monochrome silhouette, enlarged`}>
              <MarkSvg id={mark.id} mono size={44} />
            </div>
            <div className="cx-side">
              <SideRow selected icon={<MarkSvg id={mark.id} mono size={16} />} label={mark.name.toLowerCase()} />
              <span className="cx-dim">True size: 16 pt</span>
            </div>
          </div>
          <ul className="cx-warn" data-testid="cx-warnings" aria-label="Warnings from the app">
            {mark.warnings.map((w) => (
              <li key={w}><TriangleAlert size={14} aria-hidden="true" /><span>{w}</span></li>
            ))}
          </ul>
        </div>
      </section>
      <hr className="cx-rule" />
      <SizeToy glyph={(px) => <MarkSvg id={mark.id} mono size={px} />} label={mark.name.toLowerCase()} />
    </div>
  );
}
