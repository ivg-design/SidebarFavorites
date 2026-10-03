"use client";
// The demo: drop, paste or choose an SVG (or start from a sample). It is flattened to a silhouette with a CSS mask,
// shown enlarged and in a real 16 px sidebar row, with the warnings the app would list, parsed from the file.
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore, type ClipboardEvent, type DragEvent } from "react";
import { TriangleAlert } from "lucide-react";
import { SideRow } from "../finder/Finder";
import SizeToy from "../SizeToy";
import Silhouette from "./Silhouette";
import { MARKS, MarkSvg, type MarkId } from "./marks";
import { analyse, maskUrl, MAX_BYTES, MSG } from "./svg";

type Active = { id: MarkId } | { id: "file"; name: string; svg: string; warnings: string[] };
const subscribe = () => () => {};

export default function CustomDemos() {
  const [active, setActive] = useState<Active>({ id: "a" });
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uid = useId();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  // Samples go through the same parser as a dropped file; on the server (no DOMParser) they show unparsed.
  const samples = useMemo(() => {
    const out = {} as Record<MarkId, { svg: string; warnings: string[] | null }>;
    for (const m of MARKS) {
      const a = mounted ? analyse(m.svg) : null;
      out[m.id] = a && a.ok ? { svg: a.svg, warnings: a.warnings } : { svg: m.svg, warnings: null };
    }
    return out;
  }, [mounted]);

  const cur = active.id === "file" ? active : { ...samples[active.id], name: MARKS.find((m) => m.id === active.id)!.name };
  const label = cur.name.toLowerCase();
  const mask = maskUrl(cur.svg);
  const warnings = cur.warnings;

  const load = useCallback((text: string, name: string) => {
    const a = analyse(text);
    if (!a.ok) { setNote({ kind: "err", text: a.error }); return; }
    setActive({ id: "file", name: name.replace(/\.[^.]*$/, "") || "pasted", svg: a.svg, warnings: a.warnings });
    setNote({ kind: "ok", text: `Loaded ${name}.` });
  }, []);

  const readFile = useCallback(async (f: File) => {
    if (f.size > MAX_BYTES) { setNote({ kind: "err", text: MSG.big }); return; }
    load(await f.text(), f.name);
  }, [load]);

  const take = useCallback((dt: DataTransfer | null) => {
    const f = dt?.files?.[0];
    if (f) { void readFile(f); return true; }
    const t = dt?.getData("text/plain");
    if (t) { load(t, "pasted.svg"); return true; }
    return false;
  }, [readFile, load]);

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); take(e.dataTransfer); };
  const onPaste = (e: ClipboardEvent) => { if (take(e.clipboardData)) e.preventDefault(); };

  return (
    <div className="cx-demo" data-testid="cx-demo">
      <div
        className="cx-zone" tabIndex={0} role="group" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`}
        data-over={over} data-testid="cx-zone" onPaste={onPaste} onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      >
        <p id={`${uid}-t`} className="cx-zone-t">Drop an SVG here, or paste one</p>
        <p id={`${uid}-d`} className="fine cx-zone-d">This page reads files up to 512 KB. Nothing leaves your browser.</p>
        <button type="button" className="btn btn-primary" data-testid="cx-choose" onClick={() => input.current?.click()}>Choose a file</button>
        <input
          ref={input} type="file" hidden accept=".svg,image/svg+xml" data-testid="cx-file" aria-label="Choose an SVG file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }}
        />
      </div>
      <p className="fine cx-note-line" role="status" data-kind={note?.kind} data-testid="cx-message">{note?.text ?? ""}</p>

      <div className="cx-marks" role="group" aria-label="Or start from a sample">
        {MARKS.map((m) => (
          <button
            key={m.id} type="button" className="cx-mark" aria-pressed={active.id === m.id}
            data-testid={`cx-mark-${m.id}`} onClick={() => { setActive({ id: m.id }); setNote(null); }}
          >
            <MarkSvg id={m.id} size={28} />
            <span className="cx-mark-txt"><b>{m.name}</b><i>{m.kind}</i></span>
          </button>
        ))}
      </div>

      <div className="cx-panel" data-testid="cx-panel">
        <section aria-labelledby={`${uid}-r`} className="cx-block">
          <div className="cx-phead">
            <h3 id={`${uid}-r`} className="cx-h">What the app would ship</h3>
            <span className="cx-src" data-testid="cx-source">{active.id === "file" ? active.name : "Sample"}</span>
          </div>
          <div className="cx-ship">
            <div className="cx-tile cx-tile-lg" data-testid="cx-silhouette" data-mark={active.id} role="img" aria-label={`${label}: monochrome silhouette, enlarged`}>
              <Silhouette mask={mask} px={72} testId="cx-tile-sil" />
            </div>
            <div className="cx-side">
              <SideRow selected icon={<Silhouette mask={mask} px={16} testId="cx-row-sil" />} label={<span data-testid="cx-row-label">{label}</span>} />
              <span className="cx-dim">True size: 16 pt</span>
            </div>
          </div>
          <div className="cx-warnwrap" aria-live="polite">
            {warnings && warnings.length > 0 && (
              <ul className="cx-warn" data-testid="cx-warnings" aria-label="What the app would say">
                {warnings.map((w) => (
                  <li key={w}><TriangleAlert size={14} aria-hidden="true" /><span>{w}</span></li>
                ))}
              </ul>
            )}
            {warnings && warnings.length === 0 && <p className="cx-clean" data-testid="cx-clean">No warnings.</p>}
          </div>
        </section>
        <hr className="cx-rule" />
        <SizeToy glyph={(px) => <Silhouette mask={mask} px={px} />} label={label} />
      </div>
    </div>
  );
}
