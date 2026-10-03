"use client";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ChevronDown, Folder } from "lucide-react";
import { FAVS, Glyph } from "./glyphs";
import { EASE_QUART, EASE_QUINT } from "./motion/Reveal";

/** Folder (the grey default) plus eleven glyphs from the shared registry. */
const OPTIONS = ["folder", "hammer.fill", "music.note", "paintpalette", "paperplane.fill", "arrow.triangle.branch", "icloud", "camera", "star.fill", "heart.fill", "bookmark.fill", "flag.fill"];
const COLS = 4;
const DEFAULTS = FAVS.map((f) => f.glyph);

function RowIcon({ name, reduce }: { name: string; reduce: boolean }) {
  return (
    <AnimatePresence initial={false}>
      <motion.span
        key={name} className={name === "folder" ? undefined : "glyph"}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: reduce ? 0 : 0.28, ease: EASE_QUINT } }}
        exit={{ opacity: 0, scale: 0.6, transition: { duration: reduce ? 0 : 0.2, ease: EASE_QUINT } }}
      >
        {name === "folder" ? <Folder size={16} strokeWidth={1.5} /> : <Glyph name={name} />}
      </motion.span>
    </AnimatePresence>
  );
}

export default function BeforeAfter() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.3 });
  const go = reduce || seen;
  const uid = useId();
  const t = (d: number, delay = 0) => ({ duration: reduce ? 0 : d, delay: reduce ? 0 : delay, ease: EASE_QUART });

  const [icons, setIcons] = useState<string[]>(DEFAULTS);
  const [shown, setShown] = useState<boolean[]>(() => FAVS.map(() => reduce));
  const [open, setOpen] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const optRefs = useRef<(HTMLDivElement | null)[]>([]);
  const popRef = useRef<HTMLDivElement>(null);

  // first-paint reveal: grey folders swap to glyphs top to bottom, once
  useEffect(() => {
    if (!go) return;
    const timers = FAVS.map((_, i) => setTimeout(() => setShown((p) => p.map((v, k) => (k === i ? true : v))), reduce ? 0 : 700 + i * 60));
    return () => timers.forEach(clearTimeout);
  }, [go, reduce]);

  const close = useCallback((refocus: boolean) => {
    setOpen((cur) => {
      if (cur !== null && refocus) rowRefs.current[cur]?.focus();
      return null;
    });
    setHint(null);
  }, []);

  // click outside closes
  useEffect(() => {
    if (open === null) return;
    const on = (e: PointerEvent) => {
      const n = e.target as Node;
      if (popRef.current?.contains(n) || rowRefs.current[open]?.contains(n)) return;
      close(false);
    };
    document.addEventListener("pointerdown", on);
    return () => document.removeEventListener("pointerdown", on);
  }, [open, close]);

  // move focus into the listbox on open
  useEffect(() => {
    if (open === null) return;
    const cur = Math.max(0, OPTIONS.indexOf(icons[open]));
    optRefs.current[cur]?.focus({ preventScroll: true });
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
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") { e.preventDefault(); close(true); }
  };

  const changed = icons.some((g, i) => g !== DEFAULTS[i]);
  const iconOf = (i: number) => (shown[i] ? icons[i] : "folder");

  return (
    <section className="ba" aria-labelledby="ba-title">
      <div className="wrap">
        <div className="ba-grid">
          <div className="ba-pair" ref={ref}>
            <div className="ba-col">
              <h3>Before</h3>
              <div className="side-card">
                <div className="f-h">Favorites</div>
                <ul className="f-list">
                  {FAVS.map((f) => (
                    <li className="f-row" key={f.name}>
                      <span className="f-ic"><Folder size={16} strokeWidth={1.5} /></span>
                      <span className="f-label">{f.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <svg className="arrow" viewBox="0 0 56 32" fill="none" aria-hidden="true" focusable="false">
              <motion.rect
                className="shaft" x="2" y="14.5" width="48" height="3" rx="1.5" fill="currentColor"
                style={{ transformBox: "fill-box", transformOrigin: "0% 50%" }}
                initial={false} animate={{ scaleX: go ? 1 : 0 }} transition={t(0.5)}
              />
              <motion.path
                d="M38 5 L51 16 L38 27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                initial={false} animate={{ opacity: go ? 1 : 0 }} transition={t(0.25, 0.4)}
              />
            </svg>
            <div className="ba-col" data-after="true">
              <h3>After</h3>
              <div className="side-card">
                <div className="f-h">Favorites</div>
                <ul className="f-list">
                  {FAVS.map((f, i) => {
                    const isOpen = open === i;
                    const popId = `${uid}-pop-${i}`;
                    return (
                      <li className="f-li" key={f.name}>
                        <button
                          type="button" className="f-row f-btn" data-testid={`after-row-${i}`}
                          ref={(el) => { rowRefs.current[i] = el; }}
                          aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={isOpen ? popId : undefined}
                          aria-label={`${f.name}, change icon`}
                          onClick={() => (isOpen ? close(true) : setOpen(i))}
                        >
                          <span className="f-ic"><RowIcon name={iconOf(i)} reduce={reduce} /></span>
                          <span className="f-label">{f.name}</span>
                          <ChevronDown className="f-chev" size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              ref={popRef} id={popId} className="glyph-pop" data-testid="glyph-popover"
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1, transition: { duration: reduce ? 0 : 0.24, ease: EASE_QUINT } }}
                              exit={{ opacity: 0, scale: 0.96, transition: { duration: reduce ? 0 : 0.18, ease: EASE_QUINT } }}
                            >
                              <p className="gp-title" id={`${popId}-t`}>Choose an icon for {f.name}</p>
                              <div className="gp-grid" role="listbox" aria-labelledby={`${popId}-t`} onMouseLeave={() => setHint(null)}>
                                {OPTIONS.map((g, k) => (
                                  <div
                                    key={g} role="option" tabIndex={-1} className="gp-opt"
                                    ref={(el) => { optRefs.current[k] = el; }}
                                    aria-selected={icons[i] === g} aria-label={g === "folder" ? "Folder (default)" : g}
                                    data-testid={`glyph-option-${g}`}
                                    onClick={() => choose(i, g)}
                                    onKeyDown={(e) => onOptKey(e, k, i)}
                                    onFocus={() => setHint(g)}
                                    onMouseEnter={() => setHint(g)}
                                  >
                                    {g === "folder" ? <Folder size={18} strokeWidth={1.5} aria-hidden="true" /> : <Glyph name={g} size={18} />}
                                  </div>
                                ))}
                              </div>
                              <p className="gp-name" aria-hidden="true">{hint ?? icons[i]}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <p className="ba-help">
              Click a row to choose its icon. This is what the app&rsquo;s editor does.
              {changed && (
                <>
                  {" "}
                  <button type="button" className="ba-reset" data-testid="after-reset" onClick={() => { close(false); setIcons(DEFAULTS); }}>Reset</button>
                </>
              )}
            </p>
          </div>
          <div className="ba-copy">
            <h2 id="ba-title" className="display">Same eight folders. Now you can tell them apart at a glance.</h2>
            <p className="lede">Finder labels every favorite with its folder name and the same grey glyph, so your eye has to read the whole list every time. A distinct silhouette per row is what the sidebar was missing.</p>
            <p className="note-coral">Icons stay monochrome — Finder tints them to match the sidebar. Shape is the signal.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
