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
    <div className="hw-panel" data-testid="how-playground">
      <div className="hw-field">
        <label htmlFor={`${id}-in`} className="hw-label">Symbol name</label>
        <input
          id={`${id}-in`} className="hw-input" type="text" value={text} list={`${id}-dl`} data-testid="how-symbol-input"
          onChange={(e) => update(e.target.value)} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          aria-describedby={`${id}-hint`}
        />
        <datalist id={`${id}-dl`}>{PICKS.map((n) => <option key={n} value={n} />)}</datalist>
      </div>
      <p className="hw-hint" id={`${id}-hint`} aria-live="polite" data-miss={miss}>
        {miss ? "Not one of the quick picks here — the app searches all 8,300." : "Type a name, or click a quick pick."}
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
          <div className="hw-tile" data-testid="how-preview-glyph" data-glyph={glyph}><Glyph name={glyph} size={44} /></div>
          <Sidebar className="hw-side" data-testid="how-preview-row">
            <SideRow icon={<Glyph name={glyph} size={16} />} label="Projects" />
          </Sidebar>
        </div>
        <p className="hw-note">Enlarged, and at true sidebar size: 16 pt tall, monochrome.</p>
      </div>
    </div>
  );
}
