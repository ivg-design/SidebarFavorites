"use client";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { Glyph, GLYPHS } from "../glyphs";
import { SF_PATHS } from "../glyphs-sf";
import { FolderGlyph, Morph, Sidebar, SideRow } from "../finder/Finder";
import { nb } from "@/lib/nowrap";

const CATALOGUE_COUNT = 9184; // the count on the Mac that built this page; replaced by names.length once loaded
const MAX_CHIPS = 24;
const MAX_HITS = 100; // names the wall can light at its start (visible rows x SLOTS)
const SLOTS = 5;

const drawable = (n: string) => Boolean(SF_PATHS[n] || GLYPHS[n]);
/** Names the site can draw, in a stable order: the SF silhouettes first, then the stand-ins. */
const DRAWABLE: string[] = Array.from(new Set([...Object.keys(SF_PATHS).filter((k) => !k.startsWith("custom.")), ...Object.keys(GLYPHS)]));
const DRAWABLE_FIRST = DRAWABLE.slice(0, MAX_CHIPS);

function search(names: string[] | null, q: string): { total: number; list: string[] } {
  const k = q.trim().toLowerCase();
  if (!k) return { total: names ? names.length : CATALOGUE_COUNT, list: DRAWABLE_FIRST };
  const pool = names ?? DRAWABLE;
  const hits = pool.filter((n) => n.toLowerCase().includes(k));
  // drawable names first, so the first hit usually resolves a real glyph
  const sorted = [...hits.filter(drawable), ...hits.filter((n) => !drawable(n))];
  return { total: hits.length, list: sorted };
}

export default function SymbolStage({ wall, head }: { wall: ReactNode; head: ReactNode }) {
  const id = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [names, setNames] = useState<string[] | null>(null);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [paused, setPaused] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  // lazy catalogue: first focus, or when the stage nears the viewport
  const loading = useRef(false);
  const load = () => {
    if (loading.current) return;
    loading.current = true;
    import("@/data/sf-names.json").then((m) => setNames((m.default ?? m) as unknown as string[]));
  };
  useEffect(() => {
    const el = stageRef.current?.closest("section") ?? null; // the stage itself has no box (display: contents)
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); io.disconnect(); } }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDq(q), 60);
    return () => window.clearTimeout(t);
  }, [q]);

  const { total, list } = useMemo(() => search(names, dq), [names, dq]);
  const chips = list.slice(0, MAX_CHIPS);
  const count = names ? names.length : CATALOGUE_COUNT;
  const n = (v: number) => v.toLocaleString("en-US");

  // the wall: matches stay lit, the rest dim; lit names are placed at the start of each row so they can be read
  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    const spans = root.querySelectorAll<HTMLElement>(".sy-n");
    const k = dq.trim().toLowerCase();
    const vis = Array.from(root.querySelectorAll<HTMLElement>(".sy-row")).filter((e) => getComputedStyle(e).display !== "none").map((e) => e.dataset.r);
    const rows = vis.length || 1;
    const place = new Map<string, string>();
    if (k) list.slice(0, MAX_HITS).forEach((name, j) => {
      const r = vis[j % rows], i = Math.floor(j / rows);
      if (i < SLOTS) place.set(`${r}:${i}`, name);
    });
    spans.forEach((s) => {
      const row = (s.closest(".sy-row") as HTMLElement | null)?.dataset.r;
      const put = place.get(`${row}:${s.dataset.i}`);
      const text = put ?? s.dataset.n ?? "";
      if (s.textContent !== text) s.textContent = text;
      if (k && text.toLowerCase().includes(k)) s.setAttribute("data-hit", ""); else s.removeAttribute("data-hit");
    });
  }, [dq, list]);

  function pick(name: string) { setSel(name); }
  const selDraw = sel ? drawable(sel) : false;

  return (
    <div className="sy-stage" ref={stageRef} data-testid="symbols-stage" data-q={dq.trim() ? "true" : "false"} data-paused={paused}>
      {wall}
      <button type="button" className="sy-pause" aria-pressed={paused} aria-label="Pause the drifting names" data-testid="symbols-pause" onClick={() => setPaused((p) => !p)}>
        {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
      </button>
      <div className="wrap sy-wrap">
        <div className="sy-head">{head}</div>
        <div className="sy-panel" role="search">
          <label htmlFor={`${id}-in`} className="sy-label">Symbol name</label>
          <input
            id={`${id}-in`} className="sy-input mono" type="search" value={q} data-testid="symbols-input" placeholder="hammer.fill"
            autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-describedby={`${id}-count`}
            onFocus={load}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { const first = search(names, q).list[0]; if (first) { e.preventDefault(); pick(first); } }
              if (e.key === "ArrowDown") { const b = resultsRef.current?.querySelector<HTMLButtonElement>("button"); if (b) { e.preventDefault(); b.focus(); } }
            }}
          />
          <p className="sy-count fine" id={`${id}-count`} aria-live="polite" data-testid="symbols-count">
            {dq.trim()
              ? `${n(total)} of ${n(count)} names on the Mac that built this page`
              : `${n(count)} names on the Mac that built this page. Showing ${MAX_CHIPS} this page can draw.`}
          </p>

          <div className="sy-results" ref={resultsRef} role="group" aria-label="Matching symbol names" data-testid="symbols-chips"
            onKeyDown={(e) => {
              const bs = Array.from(resultsRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
              const i = bs.indexOf(document.activeElement as HTMLButtonElement);
              if (i < 0) return;
              const to = e.key === "ArrowRight" ? bs[i + 1] : e.key === "ArrowLeft" ? bs[i - 1] : null;
              if (to) { e.preventDefault(); to.focus(); }
            }}>
            {chips.length ? chips.map((name) => (
              <button key={name} type="button" className="sy-chip mono" title={name} aria-pressed={sel === name} data-testid={`symbols-chip-${name}`} onClick={() => pick(name)}>
                {name}
              </button>
            )) : (
              <p className="sy-empty" data-testid="symbols-empty">{nb("No symbol is called that. The app also matches keywords; this page only matches names.")}</p>
            )}
          </div>

          <div className="sy-out" aria-live="polite">
            <Sidebar className="sy-side" data-testid="symbols-row" data-glyph={sel && selDraw ? sel : "folder"}>
              <SideRow icon={<Morph glyph={sel && selDraw ? sel : "folder"} on={Boolean(sel && selDraw)} />} label="Projects" />
            </Sidebar>
            <div className="sy-big" data-testid="symbols-big">
              <span className="sy-big-ic" aria-hidden="true">{sel && selDraw ? <Glyph name={sel} size={44} /> : <FolderGlyph />}</span>
              <span className="sy-big-name mono">{sel ?? "Pick a name"}</span>
            </div>
            <p className="sy-note fine" data-testid="symbols-note">
              {sel && !selDraw
                ? nb("The app draws every symbol; this page only has silhouettes for a few dozen.")
                : sel ? "Drawn here as the site’s own stand-in, monochrome, at 16 pt." : "Click a name to give the folder its symbol."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
