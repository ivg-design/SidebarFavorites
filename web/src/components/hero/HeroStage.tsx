"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useReducedMotion } from "framer-motion";
import type { gsap as Gsap } from "gsap";
import type { ScrollTrigger as ST } from "gsap/ScrollTrigger";
import { Download, RotateCcw } from "lucide-react";
import { FolderGlyph, FolderTile, MacWindow, Pane, Sidebar, SideHeading, SideRow } from "../finder/Finder";
import { FAVS, Glyph } from "../glyphs";
import CopyButton from "../CopyButton";
import { nb } from "@/lib/nowrap";
import RowGlyph from "./RowGlyph";

/* Native metrics (13 px Finder): sidebar 204 wide; strip 52 + sidebar 278 = 330 tall. One transform (--z) scales them. */
const SIDE_W = 204;
const WORD = "legible";
const FIRST_MS = 900;        // row 0 resolves
const STAGGER_MS = 90;       // rows top to bottom; folder k of the headline and letter k resolve with row k
const SAT_MS = 900;          // colour starts arriving with the first row (CSS transition is 1000 ms)
const DONE_MS = 2300;
const SCRUB_MQ = "(min-width: 900px) and (prefers-reduced-motion: no-preference)";
const CONTENTS: Record<string, string[]> = {
  Forge: ["Dies", "Blanks", "Orders", "Quotes", "Photos", "Archive", "Drawings", "Suppliers", "Jigs", "Invoices"],
  Samples: ["Kicks", "Snares", "Pads", "Field", "Vocals", "Loops", "FX", "Bass", "Keys", "Stems"],
  Brand: ["Logo", "Type", "Colour", "Decks", "Social", "Print", "Guidelines", "Icons", "Photos", "Motion"],
  "Launch 2026": ["Plan", "Site", "Press", "Video", "Budget", "Legal", "Partners", "Assets", "Timeline", "Scripts"],
  Repos: ["sidebarfavorites", "fnav-plus", "lerp", "rav", "exlib", "tap", "herald", "web-watcher", "rfp", "nemo"],
  "Google Drive": ["Shared", "Clients", "Invoices", "Scans", "Backups", "Misc", "Contracts", "Receipts", "Photos", "Forms"],
  Shoots: ["2026-01 Studio", "2026-02 Loft", "Selects", "RAW", "Edits", "Delivered", "Proofs", "Lightroom", "Backdrops", "LUTs"],
  Invoices: ["2024", "2025", "2026", "Paid", "Overdue", "Templates", "Drafts", "Credit notes", "Receipts", "Tax"],
};
/** The app's quick-pick grid: the grey folder default plus seventeen glyphs, 6 × 3. */
const PICKS = [
  "folder", "hammer.fill", "music.note", "paintpalette", "paperplane.fill", "arrow.triangle.branch",
  "icloud", "camera", "doc.text.magnifyingglass", "star.fill", "heart.fill", "bookmark.fill",
  "flag.fill", "tag.fill", "archivebox.fill", "briefcase.fill", "doc.text", "photo",
];
const COLS = 6;

type Src = "col" | "rest";
interface OpenState { i: number; src: Src }

/** The sidebar content shared by the poster column and the resting window (same rows, same state). */
function SideRows({ src, icons, sel, open, onRow }: { src: Src; icons: string[]; sel: number; open: OpenState | null; onRow: (i: number, src: Src) => void }) {
  const pre = src === "col" ? "hero-row" : "hero-rest-row";
  return (
    <>
      <SideHeading>Favorites</SideHeading>
      <SideRow icon={<Glyph name="desktopcomputer" />} label="Desktop" />
      {FAVS.map((f, i) => (
        <SideRow
          key={f.name} type="button" data-testid={`${pre}-${i}`} data-glyph={icons[i]}
          selected={sel === i} aria-pressed={sel === i} aria-haspopup="dialog" aria-expanded={open?.i === i && open.src === src}
          aria-label={`${f.name}: choose its sidebar icon`}
          icon={<RowGlyph name={icons[i]} />} label={f.name}
          onClick={() => onRow(i, src)}
        />
      ))}
      <SideRow icon={<Glyph name="arrow.down.circle" />} label="Downloads" />
    </>
  );
}

export default function HeroStage({ dmgUrl, brew }: { dmgUrl: string; brew: string }) {
  const reduce = !!useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const restRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [icons, setIcons] = useState<string[]>(() => FAVS.map(() => "folder"));
  const [rev, setRev] = useState<boolean[]>(() => WORD.split("").map(() => false));
  const [lit, setLit] = useState(false);
  const [colKey, setColKey] = useState(0);
  const [reset, setReset] = useState(true);
  const [done, setDone] = useState(false);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState<OpenState | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; sc: number }>({ top: 0, left: 0, sc: 1 });
  const [run, setRun] = useState(0);
  const openRef = useRef<OpenState | null>(null);
  useLayoutEffect(() => { openRef.current = open; });

  const rowEl = useCallback((o: OpenState) => stageRef.current?.querySelector<HTMLElement>(`[data-testid="${o.src === "col" ? "hero-row" : "hero-rest-row"}-${o.i}"]`) ?? null, []);

  // the move: column settles, then row k, folder k and letter k resolve together; colour arrives with them
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    if (reduce) {
      t(() => { setReset(true); setIcons(FAVS.map((f) => f.glyph)); setRev(WORD.split("").map(() => true)); setLit(true); setDone(true); }, 0);
      t(() => setReset(false), 60);
      return () => timers.forEach(clearTimeout);
    }
    t(() => { setReset(true); setIcons(FAVS.map(() => "folder")); setRev(WORD.split("").map(() => false)); setLit(false); setDone(false); setColKey((k) => k + 1); }, 0);
    t(() => setReset(false), 60);
    t(() => setLit(true), SAT_MS);
    FAVS.forEach((f, i) => t(() => {
      setIcons((p) => p.map((v, k) => (k === i ? f.glyph : v)));
      if (i < WORD.length) setRev((p) => p.map((v, k) => (k === i ? true : v)));
    }, FIRST_MS + i * STAGGER_MS));
    t(() => setDone(true), DONE_MS);
    return () => timers.forEach(clearTimeout);
  }, [reduce, run]);

  const close = useCallback((refocus: boolean) => {
    const cur = openRef.current;
    if (cur && refocus) rowEl(cur)?.focus();
    setOpen(null);
  }, [rowEl]);
  const closeRef = useRef(close);
  useLayoutEffect(() => { closeRef.current = close; });

  // the picker sits beside the clicked row (scaled like the row, capped to the stage); a bottom sheet on phones (CSS)
  useLayoutEffect(() => {
    if (!open) return;
    const stage = stageRef.current, row = rowEl(open), pop = popRef.current;
    if (!stage || !row || !pop) return;
    const s = stage.getBoundingClientRect(), r = row.getBoundingClientRect();
    const rs = r.height / 24;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const sc = Math.max(0.9, Math.min(rs, 1.7, (s.width - 16) / pw, (s.height - 16) / ph)); // beside the row at the row's scale, never past 1.7 and never off the stage
    const left = Math.max(8, Math.min(r.right - s.left + 10, s.width - pw * sc - 8));
    const top = Math.max(8, Math.min(r.top - s.top - 10 * sc, s.height - ph * sc - 8));
    setPos({ top, left, sc });
    const cur = PICKS.indexOf(icons[open.i]);
    requestAnimationFrame(() => optRefs.current[cur >= 0 ? cur : 0]?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rowEl]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!popRef.current?.contains(e.target as Node) && !rowEl(open)?.contains(e.target as Node)) close(false); };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(true); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close, rowEl]);

  // the zoom-out: the poster column scrubs down to its seat inside a real Finder window (desktop, motion allowed)
  useEffect(() => {
    const stage = stageRef.current, section = stage?.closest("section");
    const col = colRef.current, box = boxRef.current, head = headRef.current, tools = toolsRef.current;
    const rest = restRef.current, win = restRef.current?.querySelector<HTMLElement>(".mac-win"), how = howRef.current, shade = shadeRef.current;
    if (!shade || !stage || !section || !col || !box || !head || !tools || !rest || !win || !how) return;
    const mq = window.matchMedia(SCRUB_MQ);
    // gsap is loaded on demand: phones and reduced-motion visitors never download it
    let lib: { gsap: typeof Gsap; ScrollTrigger: typeof ST } | undefined;
    let loading = false, dead = false;
    let ctx: { revert(): void } | undefined;
    let st: ST | undefined;
    const zNow = () => box.offsetWidth / SIDE_W;
    const target = () => {
      const s = box.getBoundingClientRect(), w = win.getBoundingClientRect(); // offset from the column's own seat
      return { x: w.left - s.left, y: w.top - s.top, sc: w.width / win.offsetWidth };
    };
    const setInert = (p: number) => {
      col.inert = p >= 0.8; rest.inert = p < 0.8; how.inert = p < 0.8;
      tools.style.pointerEvents = p > 0.3 ? "none" : "";
      stage.dataset.phase = p >= 0.8 ? "rest" : "col";
    };
    const build = () => {
      ctx?.revert(); ctx = undefined; st = undefined;
      col.inert = false; rest.inert = false; how.inert = false;
      if (!mq.matches || dead) return;
      if (!lib) {
        if (loading) return;
        loading = true;
        Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, s2]) => {
          lib = { gsap: g.gsap, ScrollTrigger: s2.ScrollTrigger };
          lib.gsap.registerPlugin(lib.ScrollTrigger);
          loading = false;
          build();
          lib.ScrollTrigger.refresh();
          if (location.hash === "#how") { toHow("instant"); t2 = setTimeout(() => toHow("instant"), 500); }
        });
        return;
      }
      const { gsap } = lib;
      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: section, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true,
            onUpdate: (self) => { setInert(self.progress); if (openRef.current) closeRef.current(false); },
            onRefresh: (self) => setInert(self.progress),
          },
        });
        tl.fromTo(head, { y: 0, opacity: 1 }, { y: -48, opacity: 0, duration: 0.35 }, 0)
          .fromTo(tools, { opacity: 1 }, { opacity: 0, duration: 0.35 }, 0)
          .fromTo(col, { x: 0, y: 0, scale: zNow }, { x: () => target().x, y: () => target().y, scale: () => target().sc, duration: 1 }, 0)
          .fromTo(col, { opacity: 1 }, { opacity: 0, duration: 0.1 }, 0.9)
          .fromTo(rest, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.7)
          .fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0.65)
          .fromTo(how, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35 }, 0.65);
        st = tl.scrollTrigger;
        gsap.set(col, { transformOrigin: "0 0" });
        setInert(st?.progress ?? 0);
      }, stage);
    };
    let t1: ReturnType<typeof setTimeout> | undefined, t2: ReturnType<typeof setTimeout> | undefined;
    // "#how" lives at the end of the scroll range: land on the resting state
    const toHow = (behavior: ScrollBehavior) => { if (st) window.scrollTo({ top: st.end, behavior }); };
    build();
    mq.addEventListener("change", build);
    document.fonts?.ready.then(() => lib?.ScrollTrigger.refresh());
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !st || !mq.matches) return;
      const u = new URL(a.href, location.href);
      if (u.hash !== "#how" || u.pathname !== location.pathname) return;
      e.preventDefault();
      history.replaceState(null, "", "#how");
      toHow("smooth");
    };
    document.addEventListener("click", onClick, true);
    return () => {
      dead = true;
      clearTimeout(t1); clearTimeout(t2);
      document.removeEventListener("click", onClick, true);
      mq.removeEventListener("change", build);
      ctx?.revert();
    };
  }, []);

  const onRow = (i: number, src: Src) => { setSel(i); setOpen((o) => (o && o.i === i && o.src === src ? null : { i, src })); };
  const pick = (i: number, glyph: string) => { setIcons((p) => p.map((v, k) => (k === i ? glyph : v))); close(true); };
  const gridKeys = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const n = PICKS.length;
    const map: Record<string, number> = { ArrowRight: idx + 1, ArrowLeft: idx - 1, ArrowDown: idx + COLS, ArrowUp: idx - COLS, Home: 0, End: n - 1 };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    optRefs.current[Math.max(0, Math.min(n - 1, next))]?.focus();
  };

  const title = FAVS[sel].name;
  return (
    <div className="hx-stage" ref={stageRef} data-done={done} data-lit={lit} data-reset={reset} data-phase="col" data-testid="hero-stage">
      <div className="vivid hx-vivid" data-testid="hero-vivid" aria-hidden="true" />

      <div className="hx-shade" ref={shadeRef} aria-hidden="true" />

      <div className="hx-hero">
        <div className="hx-head" ref={headRef}>
          <h1 id="hero-title-h1" className="h1 hx-h1">
            <span className="sr-only">Your sidebar, finally legible.</span>
            <span className="hx-lines" aria-hidden="true">
              <span className="hx-l">Your sidebar,</span>{" "}
              <span className="hx-l hx-l2">finally</span>{" "}
              <span className="pivot hx-word" data-testid="hero-word">
                <span className="hx-letters">
                  {WORD.split("").map((c, k) => (
                    <span key={k} className="hx-ch" data-on={rev[k]} data-k={k}>{c}</span>
                  ))}
                  <span className="hx-folders" data-testid="hero-folders">
                    {WORD.split("").map((_, k) => (
                      <span key={k} className="hx-f" data-on={rev[k]} data-k={k}><FolderGlyph /></span>
                    ))}
                  </span>
                </span>.
              </span>
            </span>
          </h1>
          <div className="hx-sub">
            <p className="lede hx-lede">
              {nb("Finder gives every favorite the same grey folder. SidebarFavorites puts the icon you want on each one — any of about 8,300 SF Symbols, or any SVG you own.")}
            </p>
            <div className="hx-cta">
              <a className="btn btn-primary btn-lg hx-dmg" href={dmgUrl} data-testid="hero-dmg">
                <Download size={20} aria-hidden="true" />
                Download for Mac
              </a>
              <CopyButton text={brew} variant="chip" />
            </div>
            <p className="fine hx-fine">{nb("Free and MIT licensed. macOS 13 or later, Apple silicon and Intel.")}</p>
          </div>
        </div>

        <div className="hx-colbox" ref={boxRef}>
          <div className="hx-col" ref={colRef} data-testid="hero-col">
            <div className="hx-col-in" key={colKey}>
              <div className="hx-strip" aria-hidden="true"><span className="mac-lights"><i /><i /><i /></span></div>
              <Sidebar>
                <SideRows src="col" icons={icons} sel={sel} open={open} onRow={onRow} />
              </Sidebar>
            </div>
          </div>
        </div>

        <div className="hx-tools" ref={toolsRef}>
          <span className="hx-hint" aria-live="polite">{done ? "Click any favorite to pick its icon." : ""}</span>
          <button type="button" className="hx-replay" data-testid="hero-replay" disabled={!done} onClick={() => { close(false); setRun((r) => r + 1); }}>
            <RotateCcw size={14} aria-hidden="true" /> Replay
          </button>
        </div>
      </div>

      <div className="hx-rest" ref={restRef} data-testid="hero-rest">
        <div className="hx-restbox">
          <div className="mac-zoom" style={{ ["--z" as string]: 1.3 } as CSSProperties}>
            <MacWindow title={title} titleTestId="hero-title" sideWidth={SIDE_W} className="hx-restwin">
              <Sidebar>
                <SideRows src="rest" icons={icons} sel={sel} open={open} onRow={onRow} />
              </Sidebar>
              <Pane>{(CONTENTS[title] ?? []).map((n) => <FolderTile key={n} label={n} />)}</Pane>
            </MacWindow>
          </div>
        </div>
      </div>

      <div className="hx-how" ref={howRef}>
        <h2 className="h2 hx-h2" id="how">Pick a folder. Pick an icon. Add.</h2>
        <p className="lede hx-lede2">{nb("Three fields and a button. The name follows the folder, because Finder always labels a favorite with its folder's real name.")}</p>
      </div>

      {open && (
        <div
          ref={popRef} className="hx-pop" role="dialog" aria-label={`Icon for ${FAVS[open.i].name}`}
          style={{ top: pos.top, left: pos.left, ["--pz" as string]: pos.sc } as CSSProperties} data-testid="hero-pop"
        >
          <p className="hx-pop-h">Icon for {FAVS[open.i].name}</p>
          <div className="hx-pop-grid" role="listbox" aria-label="Quick picks">
            {PICKS.map((g, k) => (
              <button
                key={g} ref={(el) => { optRefs.current[k] = el; }} type="button" role="option" aria-selected={icons[open.i] === g}
                className="hx-opt" data-testid={`hero-pick-${g}`} title={g} onKeyDown={(e) => gridKeys(e, k)} onClick={() => pick(open.i, g)}
              >
                {g === "folder" ? <RowGlyph name="folder" /> : <Glyph name={g} size={18} />}
              </button>
            ))}
          </div>
          <p className="hx-pop-f">{nb("Browse All… in the app searches every symbol this Mac can draw, about 8,300.")}</p>
        </div>
      )}
    </div>
  );
}
