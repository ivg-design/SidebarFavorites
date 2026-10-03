"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { FolderGlyph, FolderTile, MacWindow, Pane, Sidebar, SideHeading, SideRow } from "../finder/Finder";
import { FAVS, Glyph } from "../glyphs";
import BigGlyph from "./BigGlyph";

const SYSTEM = [
  { name: "AirDrop", glyph: "dot.radiowaves.left.and.right" }, { name: "Recents", glyph: "clock" },
  { name: "Applications", glyph: "square.grid.2x2" }, { name: "Desktop", glyph: "desktopcomputer" },
  { name: "Documents", glyph: "doc.text" }, { name: "Downloads", glyph: "arrow.down.circle" },
];
const PLAIN_TILES = ["Archive", "Notes", "Receipts", "Scans", "Drafts", "Exports", "Misc"];
const WINDOW_W = 700;
const OVERHANG = 56;
const ADVANCE_MS = 2400;

/** The hero composition: vivid panel, dark Finder window, auto-advancing then user-driven selection. */
export default function HeroStage() {
  const reduce = !!useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState(0);
  const touched = useRef(false);
  const hovering = useRef(false);
  const visible = useRef(true);

  // scale the fixed 700px window to the stage, before first paint
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const vw = window.innerWidth;
      const s = vw < 600 ? 0.6 : vw >= 1180 ? (w + OVERHANG - 88) / WINDOW_W : (w - 48) / WINDOW_W;
      el.style.setProperty("--hx-s", String(Math.min(1, s)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // auto-advance until the first interaction; pause on hover and off-screen
  useEffect(() => {
    const el = stageRef.current;
    if (reduce || !el) return;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; });
    io.observe(el);
    const id = setInterval(() => {
      if (touched.current || hovering.current || !visible.current) return;
      setSel((s) => (s + 1) % FAVS.length);
    }, ADVANCE_MS);
    return () => { io.disconnect(); clearInterval(id); };
  }, [reduce]);

  const choose = (i: number) => { touched.current = true; setSel(i); };

  return (
    <div className="hx-stage" ref={stageRef}>
      <div className="vivid hx-bg" aria-hidden="true" />
      <div
        className="hx-win"
        onMouseEnter={() => { hovering.current = true; }}
        onMouseLeave={() => { hovering.current = false; }}
      >
        <MacWindow title={FAVS[sel].name} titleTestId="hero-title" sideWidth={196}>
          <Sidebar>
            <SideHeading>Favorites</SideHeading>
            {SYSTEM.map(({ name, glyph }) => (
              <SideRow key={name} icon={<Glyph name={glyph} size={16} />} label={name} />
            ))}
            {FAVS.map((f, i) => (
              <SideRow
                key={f.name}
                data-testid={`hero-row-${i}`}
                type="button"
                aria-pressed={sel === i}
                selected={sel === i}
                label={f.name}
                onMouseEnter={() => choose(i)}
                onFocus={() => choose(i)}
                onClick={() => choose(i)}
                icon={
                  <>
                    <span className="hx-f" style={{ ["--i" as string]: i }}><FolderGlyph /></span>
                    <span className="hx-g" style={{ ["--i" as string]: i }}><Glyph name={f.glyph} /></span>
                  </>
                }
              />
            ))}
          </Sidebar>
          <Pane className="hx-pane">
            <div className="hx-preview">
              <BigGlyph glyph={FAVS[sel].glyph} size={200} />
              <span className="hx-preview-name">{FAVS[sel].name}</span>
            </div>
            {FAVS.map((f, i) => <FolderTile key={f.name} label={f.name} selected={sel === i} />)}
            {PLAIN_TILES.map((n) => <FolderTile key={n} label={n} />)}
          </Pane>
        </MacWindow>
      </div>
    </div>
  );
}
