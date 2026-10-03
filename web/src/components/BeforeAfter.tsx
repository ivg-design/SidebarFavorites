"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { FolderGlyph, SideHeading, SideRow, Sidebar, Vivid } from "./finder/Finder";
import { FAVS, Glyph } from "./glyphs";
import { MacGlyph } from "./demos/macGlyph";
import { EASE_QUART } from "./motion/Reveal";
import "../app/demos.css";

/** The app's quick-pick grid: the grey folder default plus seventeen glyphs, 6 columns by 3 rows. */
const OPTIONS = [
  "folder", "hammer.fill", "music.note", "paintpalette", "paperplane.fill", "arrow.triangle.branch",
  "icloud", "camera", "doc.text.magnifyingglass", "star.fill", "heart.fill", "bookmark.fill",
  "flag.fill", "tag.fill", "archivebox.fill", "briefcase.fill", "doc.text", "photo",
];
const COLS = 6;
const POP_W = 280;
const DEFAULTS = FAVS.map((f) => f.glyph);

interface Pos { top: number; left: number; origin: string }

export default function BeforeAfter() {
  const reduce = !!useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const seen = useInView(stageRef, { once: true, amount: 0.3 });
  const go = reduce || seen;
  const uid = useId();
  const t = (d: number, delay = 0) => ({ duration: reduce ? 0 : d, delay: reduce ? 0 : delay, ease: EASE_QUART });

  const [icons, setIcons] = useState<string[]>(DEFAULTS);
  const [shown, setShown] = useState<boolean[]>(() => FAVS.map(() => reduce));
  const [open, setOpen] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0, origin: "top left" });
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const popRef = useRef<HTMLDivElement>(null);
  const rowEl = useCallback((i: number) => stageRef.current?.querySelector<HTMLElement>(`[data-testid="after-row-${i}"]`) ?? null, []);

  // first-paint reveal: grey folders morph to glyphs top to bottom, once
  useEffect(() => {
    if (!go) return;
    const timers = FAVS.map((_, i) => setTimeout(() => setShown((p) => p.map((v, k) => (k === i ? true : v))), reduce ? 0 : 700 + i * 60));
    return () => timers.forEach(clearTimeout);
  }, [go, reduce]);

  const close = useCallback((refocus: boolean) => {
    setOpen((cur) => {
      if (cur !== null && refocus) rowEl(cur)?.focus();
      return null;
    });
    setHint(null);
  }, [rowEl]);

  // place the popover under the row, flipping above near the panel bottom (desktop; CSS makes it a bottom sheet on phones)
  useLayoutEffect(() => {
    if (open === null) return;
    const stage = stageRef.current, panel = panelRef.current, pop = popRef.current, row = rowEl(open);
    if (!stage || !panel || !pop || !row) return;
    const s = stage.getBoundingClientRect(), r = row.getBoundingClientRect(), p = panel.getBoundingClientRect();
    const h = pop.offsetHeight;
    const below = r.bottom - s.top + 6;
    const flip = r.bottom - p.top + 6 + h > p.height - 8;
    const top = flip ? Math.max(8, r.top - s.top - h - 6) : below;
    const left = Math.min(Math.max(8, r.left - s.left), Math.max(8, s.width - POP_W - 8));
    setPos({ top, left, origin: flip ? "bottom left" : "top left" });
  }, [open, rowEl]);

  // click outside closes
  useEffect(() => {
    if (open === null) return;
    const on = (e: PointerEvent) => {
      const n = e.target as Node;
      if (popRef.current?.contains(n) || rowEl(open)?.contains(n)) return;
      close(false);
    };
    document.addEventListener("pointerdown", on);
    return () => document.removeEventListener("pointerdown", on);
  }, [open, close, rowEl]);

  // move focus into the listbox on open
  useEffect(() => {
    if (open === null) return;
    optRefs.current[Math.max(0, OPTIONS.indexOf(icons[open]))]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (row: number, g: string) => {
    setIcons((p) => p.map((v, k) => (k === row ? g : v)));
    close(true);
  };

  const onOptKey = (e: KeyboardEvent, idx: number, row: number) => {
    const n = OPTIONS.length;
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % n;
    else if (e.key === "ArrowLeft") next = (idx - 1 + n) % n;
    else if (e.key === "ArrowDown") next = Math.min(n - 1, idx + COLS);
    else if (e.key === "ArrowUp") next = Math.max(0, idx - COLS);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next >= 0) { e.preventDefault(); optRefs.current[next]?.focus({ preventScroll: true }); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(row, OPTIONS[idx]); }
    else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); close(true); }
  };

  const changed = icons.some((g, i) => g !== DEFAULTS[i]);
  const iconOf = (i: number) => (shown[i] ? icons[i] : "folder");
  const popId = `${uid}-pop`;

  return (
    <section className="ba2" aria-labelledby="ba-title">
      <div className="wrap">
        <div className="ba2-grid">
          <div className="ba2-head">
            <h2 id="ba-title" className="display h-sec ba2-h">Same eight folders. Now you can tell them apart at a glance.</h2>
            <div className="ba2-side"><p className="lede">Finder labels every favorite with its folder name and the same grey glyph, so your eye has to read the whole list every time. A distinct silhouette per row is what the sidebar was missing.</p>
            <p className="note-coral">Icons stay monochrome — Finder tints them to match the sidebar. Shape is the signal.</p></div>
          </div>
          <div className="ba2-demo">
            <div className="ba2-stage" ref={stageRef}>
              <div ref={panelRef}><Vivid className="ba2-panel">
                <div className="ba2-pair">
                  <div className="ba2-col">
                    <p className="ba2-label"><i />Before</p>
                    <Sidebar className="ba2-card">
                      <SideHeading>Favorites</SideHeading>
                      {FAVS.map((f) => <SideRow key={f.name} icon={<FolderGlyph />} label={f.name} />)}
                    </Sidebar>
                  </div>
                  <span className="ba2-chip"><svg className="ba2-arrow" viewBox="0 0 56 32" fill="none" aria-hidden="true" focusable="false">
                    <motion.rect
                      x="2" y="14.5" width="48" height="3" rx="1.5" fill="currentColor"
                      style={{ transformBox: "fill-box", transformOrigin: "0% 50%" }}
                      initial={false} animate={{ scaleX: go ? 1 : 0 }} transition={t(0.5)}
                    />
                    <motion.path
                      d="M38 5 L51 16 L38 27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      initial={false} animate={{ opacity: go ? 1 : 0 }} transition={t(0.25, 0.4)}
                    />
                  </svg></span>
                  <div className="ba2-col" data-after="true">
                    <p className="ba2-label"><i />After</p>
                    <Sidebar className="ba2-card">
                      <SideHeading>Favorites</SideHeading>
                      {FAVS.map((f, i) => (
                        <SideRow
                          key={f.name} icon={<MacGlyph name={iconOf(i)} />} label={f.name}
                          data-testid={`after-row-${i}`} aria-haspopup="listbox" aria-expanded={open === i}
                          aria-controls={open === i ? popId : undefined} aria-label={`${f.name}, change icon`}
                          onClick={() => (open === i ? close(true) : setOpen(i))}
                        />
                      ))}
                    </Sidebar>
                  </div>
                </div>
              </Vivid></div>
              {open !== null && (
                <>
                  <div className="ba2-scrim" aria-hidden="true" />
                  <div
                    ref={popRef} id={popId} className="mac-pick ba2-pick" data-testid="glyph-popover"
                    style={{ "--top": `${pos.top}px`, "--left": `${pos.left}px`, "--origin": pos.origin } as CSSProperties}
                  >
                    <p className="mac-pick-h" id={`${popId}-t`}>Choose an icon for {FAVS[open].name}</p>
                    <div className="mac-pick-grid" role="listbox" aria-labelledby={`${popId}-t`} onMouseLeave={() => setHint(null)}>
                      {OPTIONS.map((g, k) => (
                        <button
                          key={g} type="button" role="option" tabIndex={-1} className="mac-pick-opt"
                          ref={(el) => { optRefs.current[k] = el; }}
                          aria-selected={icons[open] === g} aria-label={g === "folder" ? "Folder (default)" : g}
                          data-testid={`glyph-option-${g}`}
                          onClick={() => choose(open, g)} onKeyDown={(e) => onOptKey(e, k, open)}
                          onFocus={() => setHint(g)} onMouseEnter={() => setHint(g)}
                        >
                          {g === "folder" ? <FolderGlyph /> : <Glyph name={g} size={18} />}
                        </button>
                      ))}
                    </div>
                    <p className="mac-pick-name" aria-hidden="true">{hint ?? icons[open]}</p>
                  </div>
                </>
              )}
            </div>
            <p className="ba2-cap">
              <span>Click a row and choose its icon. That is the whole app.</span>
              {changed && <button type="button" className="ba2-reset" data-testid="after-reset" onClick={() => { close(false); setIcons(DEFAULTS); }}>Reset</button>}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
