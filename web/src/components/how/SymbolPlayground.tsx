"use client";
import { useId, useState } from "react";
import { Glyph } from "../glyphs";
import { SF_PATHS } from "../glyphs-sf";
import { Sidebar, SideRow } from "../finder/Finder";

/** The app's quick-pick row (SF names, all drawn by the site's SF_PATHS). */
export const PICKS = [
  "hammer.fill", "music.note", "paintpalette", "paperplane.fill", "arrow.triangle.branch", "camera", "star.fill", "heart.fill",
  "bookmark.fill", "flag.fill", "tag.fill", "archivebox.fill", "briefcase.fill", "doc.text", "photo", "globe",
] as const;

/** The verb: a 420 ms cross-dissolve between the outgoing and the incoming glyph (two stacked layers). */
function Resolve({ glyph, size }: { glyph: string; size: number }) {
  const [layers, setLayers] = useState<{ a: string; b: string; on: "a" | "b" }>({ a: glyph, b: glyph, on: "a" });
  if (layers[layers.on] !== glyph) {
    const next = layers.on === "a" ? "b" : "a";
    setLayers({ ...layers, [next]: glyph, on: next });
  }
  return (
    <span className="hw-res" style={{ width: size, height: size }}>
      {(["a", "b"] as const).map((k) => (
        <span key={k} className="hw-res-l" data-on={layers.on === k} aria-hidden="true"><Glyph name={layers[k]} size={size} /></span>
      ))}
    </span>
  );
}

/** The Add Favorite window's Symbol name field, quick picks and Preview, live. */
export default function SymbolPlayground() {
  const id = useId();
  const [text, setText] = useState<string>("hammer.fill");
  const [glyph, setGlyph] = useState<string>("hammer.fill");
  const [miss, setMiss] = useState(false);

  function update(v: string) {
    setText(v);
    const k = v.trim().toLowerCase();
    if (SF_PATHS[k]) { setGlyph(k); setMiss(false); } else setMiss(k.length > 0);
  }

  return (
    <div className="hw-panel" data-testid="how-playground" role="group" aria-label="Try the Symbol name field">
      <div className="hw-field">
        <label htmlFor={`${id}-in`} className="hw-label">Symbol name</label>
        <input
          id={`${id}-in`} className="hw-input" type="text" value={text} list={`${id}-dl`} data-testid="how-symbol-input"
          onChange={(e) => update(e.target.value)} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          aria-describedby={`${id}-hint`}
        />
        <datalist id={`${id}-dl`}>{PICKS.map((n) => <option key={n} value={n} />)}</datalist>
      </div>
      <p className="hw-hint" id={`${id}-hint`} aria-live="polite" data-miss={miss} data-testid="how-hint">
        {miss ? "Not one of the names this page can draw — the app searches all 8,300." : "Type a name, or click a quick pick."}
      </p>
      <div className="hw-picks" role="group" aria-label="Quick picks">
        {PICKS.map((n) => (
          <button key={n} type="button" className="hw-pick" aria-label={n} title={n} aria-pressed={glyph === n && !miss}
            data-testid={`how-pick-${n}`} onClick={() => update(n)}>
            <Glyph name={n} size={22} />
          </button>
        ))}
      </div>
      <div className="hw-prev">
        <div className="hw-label">Preview</div>
        <div className="hw-prev-row">
          <div className="hw-tile" data-testid="how-preview-glyph" data-glyph={glyph}><Resolve glyph={glyph} size={56} /></div>
          <Sidebar className="hw-side" data-testid="how-preview-row" data-glyph={glyph}>
            <SideRow icon={<Resolve glyph={glyph} size={16} />} label="Projects" />
          </Sidebar>
        </div>
      </div>
    </div>
  );
}
