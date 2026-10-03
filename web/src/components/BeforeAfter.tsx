"use client";
import { useRef } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Folder } from "lucide-react";
import { FAVS, Glyph } from "./glyphs";
import { useHeroBus } from "./hero-bus";
import { EASE_QUART, EASE_QUINT } from "./motion/Reveal";

export default function BeforeAfter() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.3 });
  const { setPreview, preview } = useHeroBus();
  const go = reduce || seen;
  const t = (d: number, delay = 0) => ({ duration: reduce ? 0 : d, delay: reduce ? 0 : delay, ease: EASE_QUART });

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
                    const delay = 0.7 + i * 0.06;
                    return (
                      <li
                        className="f-row" key={f.name} tabIndex={0}
                        data-hover={preview?.name === f.name}
                        onMouseEnter={() => setPreview({ name: f.name, glyph: f.glyph })}
                        onMouseLeave={() => setPreview(null)}
                        onFocus={() => setPreview({ name: f.name, glyph: f.glyph })}
                        onBlur={() => setPreview(null)}
                      >
                        <span className="f-ic">
                          <motion.span initial={false} animate={{ opacity: go ? 0 : 1, scale: go ? 0.7 : 1 }}
                            transition={{ duration: reduce ? 0 : 0.48, delay: reduce ? 0 : delay, ease: EASE_QUINT }}>
                            <Folder size={16} strokeWidth={1.5} />
                          </motion.span>
                          <AnimatePresence initial={false}>
                            {go && (
                              <motion.span className="glyph" initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1, transition: { duration: reduce ? 0 : 0.48, delay: reduce ? 0 : delay, ease: EASE_QUINT } }}>
                                <Glyph name={f.glyph} />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                        <span className="f-label">{f.name}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
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
