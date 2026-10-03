"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Folder } from "lucide-react";
import { EGG_POOL, FAVS, Glyph } from "./glyphs";
import { useHeroBus } from "./hero-bus";
import { EASE_QUINT } from "./motion/Reveal";

const SYSTEM = ["Home", "Desktop", "Documents", "Downloads"];
const CUSTOM = FAVS.slice(0, 6);
const ROUNDS = 4;
const ROUND_MS = 650;

export default function FinderMock() {
  const reduce = !!useReducedMotion();
  const { preview, eggTick } = useHeroBus();
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [onState, setOn] = useState<boolean[]>(() => CUSTOM.map(() => false));
  const [override, setOverride] = useState<(string | null)[]>(() => CUSTOM.map(() => null));
  const [caption, setCaption] = useState(false);
  const on = reduce ? CUSTOM.map(() => true) : onState;
  const running = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastTick = useRef(0);

  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  // scale the fixed 640x540 design to the frame width, before first paint
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / 640));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // morph: grey folders -> glyphs, one row at a time
  useEffect(() => {
    if (reduce) return;
    CUSTOM.forEach((_, i) => later(() => setOn((p) => p.map((v, k) => (k === i ? true : v))), 450 + i * 60));
  }, [reduce]);

  // easter egg shuffle
  useEffect(() => {
    if (!eggTick || eggTick === lastTick.current) return;
    lastTick.current = eggTick;
    if (running.current) return;
    running.current = true;
    setCaption(true);
    if (reduce) { later(() => { setCaption(false); running.current = false; }, 2200); return; }
    const prev: (string | null)[] = CUSTOM.map(() => null);
    for (let r = 0; r < ROUNDS; r++) {
      CUSTOM.forEach((_, i) => {
        later(() => {
          let g = EGG_POOL[Math.floor(Math.random() * EGG_POOL.length)];
          while (g === prev[i]) g = EGG_POOL[Math.floor(Math.random() * EGG_POOL.length)];
          prev[i] = g;
          setOverride((p) => p.map((v, k) => (k === i ? g : v)));
        }, r * ROUND_MS + i * 70);
      });
    }
    const end = ROUNDS * ROUND_MS + 400;
    later(() => setOverride(CUSTOM.map(() => null)), end);
    later(() => setCaption(false), end + 900);
    later(() => { running.current = false; }, end + 1300);
  }, [eggTick, reduce]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const dIn = reduce ? 0 : 0.48;
  const dOut = reduce ? 0 : 0.36;

  return (
    <div className="finder-frame" ref={frameRef} data-ready={scale !== null}>
      <div className="finder-scale" style={{ transform: `scale(${scale ?? 1})` }}>
        <div className="finder" role="img" aria-label="A Finder window whose sidebar favorites each carry a distinct coral icon">
          <div className="f-title" aria-hidden="true">
            <i className="f-dot" style={{ background: "#FF5F57" }} />
            <i className="f-dot" style={{ background: "#FEBC2E" }} />
            <i className="f-dot" style={{ background: "#28C840" }} />
            <span className="t">Projects</span>
          </div>
          <div className="f-body" aria-hidden="true">
            <div className="f-side">
              <div className="f-h">Favorites</div>
              {SYSTEM.map((n) => (
                <div className="f-row" key={n}>
                  <span className="f-ic"><Folder size={16} strokeWidth={1.5} /></span>
                  <span className="f-label">{n}</span>
                </div>
              ))}
              {CUSTOM.map((f, i) => {
                const pv = i === 0 ? preview : null;
                const glyph = pv?.glyph ?? override[i] ?? f.glyph;
                const label = pv?.name ?? f.name;
                return (
                  <div className="f-row" key={f.name} data-sel={i === 0}>
                    <span className="f-ic">
                      <motion.span
                        initial={false}
                        animate={{ opacity: on[i] ? 0 : 1, scale: on[i] ? 0.7 : 1 }}
                        transition={{ duration: dIn, ease: EASE_QUINT }}
                      >
                        <Folder size={16} strokeWidth={1.5} />
                      </motion.span>
                      <AnimatePresence initial={false}>
                        {on[i] && (
                          <motion.span
                            key={glyph}
                            className="glyph"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1, transition: { duration: dIn, ease: EASE_QUINT } }}
                            exit={{ opacity: 0, scale: 0.6, transition: { duration: dOut, ease: EASE_QUINT } }}
                          >
                            <Glyph name={glyph} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span className="f-label">
                      <AnimatePresence initial={false}>
                        <motion.span
                          key={label}
                          className="f-lt"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.3, ease: EASE_QUINT } }}
                          exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.2, ease: EASE_QUINT } }}
                        >
                          {label}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="f-grid">
              {Array.from({ length: 8 }, (_, k) => (
                <div className={`f-tile${k % 2 ? " alt" : ""}`} key={k}><i /><b /></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="f-cap" aria-live="polite" data-show={caption}>{caption ? "8,300 SF Symbols. Pick yours." : ""}</div>
    </div>
  );
}
