"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Glyph } from "../glyphs";
import { EASE_QUART } from "../motion/Reveal";
import FolderMorph from "../rive/FolderMorph";

/** Morph targets in public/rive/folder-morph.riv (0 is the grey folder). */
const MORPH_INDEX: Record<string, number> = {
  folder: 0, "hammer.fill": 1, "music.note": 2, paintpalette: 3, "paperplane.fill": 4,
  "arrow.triangle.branch": 5, icloud: 6, camera: 7, "doc.text.magnifyingglass": 8,
};

/** The hero's focal glyph: a Rive vector morph between the folder and the row's glyph.
 *  A lucide crossfade sits underneath until the .riv has loaded (and for glyphs the file lacks). */
export default function BigGlyph({ glyph, size = 200 }: { glyph: string; size?: number }) {
  const reduce = !!useReducedMotion();
  const [ready, setReady] = useState(false);
  const [wanted, setWanted] = useState(false);
  const target = MORPH_INDEX[glyph];
  const useRive = target !== undefined;

  // The runtime (wasm) is ~0.6 MB over the wire: fetch it only once the page is idle after first paint.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const start = () => setWanted(true);
    const t = setTimeout(() => { if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 2500 }); else start(); }, 600);
    return () => clearTimeout(t);
  }, []);
  const showFallback = !useRive || !ready;
  const duration = reduce ? 0 : 0.22;
  return (
    <div className="hx-big" data-testid="hero-big" data-glyph={glyph} data-rive={useRive && ready} style={{ width: size, height: size }} aria-hidden="true">
      {showFallback && (
        <AnimatePresence initial={false}>
          <motion.span key={glyph} className="hx-big-g"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration, ease: EASE_QUART }}>
            <Glyph name={glyph} size={size} strokeWidth={1} />
          </motion.span>
        </AnimatePresence>
      )}
      {useRive && wanted && <FolderMorph className="hx-big-rive" target={target} auto={false} onReady={() => setReady(true)} />}
    </div>
  );
}
