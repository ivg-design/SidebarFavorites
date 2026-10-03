"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { FolderTile, MacWindow, Pane, Sidebar, SideHeading, SideRow } from "../finder/Finder";
import { FAVS, Glyph } from "../glyphs";
import RowGlyph from "./RowGlyph";

/* Native window metrics; the stage scales the whole window with one transform. */
const WIN_W = 980;
const WIN_H = 452;
const SIDE_W = 204;
const SETTLE_MS = 700;      // window rise
const FIRST_MS = 900;       // first row resolves
const STAGGER_MS = 90;      // rows top to bottom
const SYSTEM_TOP = [
  { name: "AirDrop", glyph: "dot.radiowaves.left.and.right" }, { name: "Recents", glyph: "clock" },
  { name: "Applications", glyph: "square.grid.2x2" }, { name: "Desktop", glyph: "desktopcomputer" },
];
const SYSTEM_BOTTOM = [{ name: "Downloads", glyph: "arrow.down.circle" }];
const CONTENTS: Record<string, string[]> = {
  Forge: ["Dies", "Blanks", "Orders", "Quotes", "Photos", "Archive", "Drawings", "Suppliers", "Jigs", "Invoices", "Scrap", "Notes"],
  Samples: ["Kicks", "Snares", "Pads", "Field", "Vocals", "Loops", "FX", "Bass", "Keys", "Stems", "Bounces", "Old"],
  Brand: ["Logo", "Type", "Colour", "Decks", "Social", "Print", "Guidelines", "Icons", "Photos", "Motion", "Web", "Archive"],
  "Launch 2026": ["Plan", "Site", "Press", "Video", "Budget", "Legal", "Partners", "Assets", "Timeline", "Scripts", "Decks", "Done"],
  Repos: ["sidebarfavorites", "fnav-plus", "lerp", "rav", "exlib", "tap", "herald", "web-watcher", "rfp", "nemo", "bakerboy", "scratch"],
  "Google Drive": ["Shared", "Clients", "Invoices", "Scans", "Backups", "Misc", "Contracts", "Receipts", "Photos", "Forms", "Exports", "Old"],
  Shoots: ["2026-01 Studio", "2026-02 Loft", "Selects", "RAW", "Edits", "Delivered", "Proofs", "Lightroom", "Backdrops", "LUTs", "Client", "Archive"],
  Invoices: ["2024", "2025", "2026", "Paid", "Overdue", "Templates", "Drafts", "Credit notes", "Receipts", "Tax", "Quotes", "Sent"],
};
/** The app's quick-pick grid: the grey folder default plus seventeen glyphs, 6 × 3. */
const PICKS = [
  "folder", "hammer.fill", "music.note", "paintpalette", "paperplane.fill", "arrow.triangle.branch",
  "icloud", "camera", "doc.text.magnifyingglass", "star.fill", "heart.fill", "bookmark.fill",
  "flag.fill", "tag.fill", "archivebox.fill", "briefcase.fill", "doc.text", "photo",
];
const COLS = 6;

export default function HeroStage() {
  const reduce = !!useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(1.3);
  const [settled, setSettled] = useState(reduce);
  const [icons, setIcons] = useState<string[]>(() => FAVS.map((f) => (reduce ? f.glyph : "folder")));
  const [done, setDone] = useState(reduce);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [run, setRun] = useState(0);
  const popRef = useRef<HTMLDivElement>(null);
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rowEl = useCallback((i: number) => stageRef.current?.querySelector<HTMLElement>(`[data-testid="hero-row-${i}"]`) ?? null, []);

  // one transform fits the native window to the stage: 1.0–1.3 on desktop, 1.15 on phones (true-ish size, never tiny)
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const vw = window.innerWidth;
      const w = el.clientWidth;
      const next = vw < 600 ? 1.15 : Math.min(1.3, Math.max(1, w / WIN_W));
      setZ(Math.round(next * 1000) / 1000);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the move: window settles, then each favorite's grey folder resolves into its glyph, top to bottom
  useEffect(() => {
    if (reduce) { setSettled(true); setIcons(FAVS.map((f) => f.glyph)); setDone(true); return; }
    setSettled(false); setDone(false); setIcons(FAVS.map(() => "folder"));
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setSettled(true), 30));
    FAVS.forEach((f, i) => timers.push(setTimeout(() => setIcons((p) => p.map((v, k) => (k === i ? f.glyph : v))), FIRST_MS + i * STAGGER_MS)));
    timers.push(setTimeout(() => setDone(true), FIRST_MS + FAVS.length * STAGGER_MS + 420));
    return () => timers.forEach(clearTimeout);
  }, [reduce, run]);

  const close = useCallback((refocus: boolean) => {
    setOpen((cur) => { if (cur !== null && refocus) rowEl(cur)?.focus(); return null; });
  }, [rowEl]);

  // picker sits beside the row (desktop) and is a sheet on phones (CSS)
  useLayoutEffect(() => {
    if (open === null) return;
    const stage = stageRef.current, row = rowEl(open), pop = popRef.current;
    if (!stage || !row || !pop) return;
    const s = stage.getBoundingClientRect(), r = row.getBoundingClientRect();
    const left = Math.min(r.right - s.left + 10, s.width - pop.offsetWidth - 8);
    const top = Math.max(8, Math.min(r.top - s.top - 10, s.height - pop.offsetHeight - 8));
    setPos({ top, left });
    const cur = PICKS.indexOf(icons[open]);
    requestAnimationFrame(() => optRefs.current[cur >= 0 ? cur : 0]?.focus());
  }, [open, icons, rowEl]);

  useEffect(() => {
    if (open === null) return;
    const onDown = (e: PointerEvent) => { if (!popRef.current?.contains(e.target as Node) && !rowEl(open)?.contains(e.target as Node)) close(false); };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(true); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close, rowEl]);

  const pick = (i: number, glyph: string) => { setIcons((p) => p.map((v, k) => (k === i ? glyph : v))); close(true); };
  const gridKeys = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const n = PICKS.length;
    const map: Record<string, number> = { ArrowRight: idx + 1, ArrowLeft: idx - 1, ArrowDown: idx + COLS, ArrowUp: idx - COLS, Home: 0, End: n - 1 };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    optRefs.current[Math.max(0, Math.min(n - 1, next))]?.focus();
  };

  const stageStyle = { ["--z" as string]: z, height: `${Math.round(WIN_H * z)}px` } as CSSProperties;
  const title = FAVS[sel].name;

  return (
    <div className="hx-stage" ref={stageRef} style={stageStyle} data-done={done} data-testid="hero-stage">
      <div className="hx-win" data-settled={settled} style={{ width: WIN_W, height: WIN_H }}>
        <MacWindow title={title} titleTestId="hero-title" sideWidth={SIDE_W} style={{ height: "100%" }}>
          <Sidebar>
            <SideHeading>Favorites</SideHeading>
            {SYSTEM_TOP.map((r) => <SideRow key={r.name} icon={<Glyph name={r.glyph} />} label={r.name} />)}
            {FAVS.map((f, i) => (
              <SideRow
                key={f.name} type="button" data-testid={`hero-row-${i}`} data-glyph={icons[i]}
                selected={sel === i} aria-pressed={sel === i} aria-haspopup="dialog" aria-expanded={open === i}
                aria-label={`${f.name}: choose its sidebar icon`}
                icon={<RowGlyph name={icons[i]} />} label={f.name}
                onClick={() => { setSel(i); setOpen((o) => (o === i ? null : i)); }}
              />
            ))}
            {SYSTEM_BOTTOM.map((r) => <SideRow key={r.name} icon={<Glyph name={r.glyph} />} label={r.name} />)}
            <SideHeading>iCloud</SideHeading>
            <SideRow icon={<Glyph name="icloud" />} label="iCloud Drive" />
          </Sidebar>
          <Pane>
            {(CONTENTS[title] ?? []).map((t) => <FolderTile key={t} label={t} />)}
          </Pane>
        </MacWindow>
      </div>

      {open !== null && (
        <div ref={popRef} className="hx-pop" role="dialog" aria-label={`Icon for ${FAVS[open].name}`} style={{ top: pos.top, left: pos.left }} data-testid="hero-pop">
          <p className="hx-pop-h">Icon for {FAVS[open].name}</p>
          <div className="hx-pop-grid" role="listbox" aria-label="Quick picks" aria-activedescendant={undefined}>
            {PICKS.map((g, k) => (
              <button
                key={g} ref={(el) => { optRefs.current[k] = el; }} type="button" role="option" aria-selected={icons[open] === g}
                className="hx-opt" data-testid={`hero-pick-${g}`} title={g} onKeyDown={(e) => gridKeys(e, k)} onClick={() => pick(open, g)}
              >
                {g === "folder" ? <RowGlyph name="folder" /> : <Glyph name={g} size={18} />}
              </button>
            ))}
          </div>
          <p className="hx-pop-f">Browse All… in the app searches every symbol this Mac can draw, about 8,300.</p>
        </div>
      )}

      <div className="hx-tools">
        <span className="hx-hint" aria-live="polite">{done ? "Click any favorite to pick its icon." : ""}</span>
        <button type="button" className="hx-replay" data-testid="hero-replay" disabled={!done} onClick={() => { close(false); setRun((r) => r + 1); }}>
          <RotateCcw size={14} aria-hidden="true" /> Replay
        </button>
      </div>
    </div>
  );
}
