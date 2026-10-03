"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Folder } from "lucide-react";
import { FAVS, Glyph } from "./glyphs";
import { EASE_QUINT } from "./motion/Reveal";

const SYSTEM = ["Home", "Desktop", "Documents", "Downloads"];
const CUSTOM = FAVS.slice(0, 6);

export default function FinderMock() {
  const reduce = !!useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [onState, setOn] = useState<boolean[]>(() => CUSTOM.map(() => false));
  const on = reduce ? CUSTOM.map(() => true) : onState;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const dIn = reduce ? 0 : 0.48;

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
                            
                            className="glyph"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1, transition: { duration: dIn, ease: EASE_QUINT } }}
                          >
                            <Glyph name={f.glyph} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span className="f-label">{f.name}</span>
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
    </div>
  );
}
