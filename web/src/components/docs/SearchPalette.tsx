"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CornerDownLeft, FileText, Hash } from "lucide-react";
import { asset } from "@/lib/config";
import type { DocIndexEntry } from "@/content/docs/types";

interface Result { key: string; kind: "page" | "section"; title: string; context: string; url: string; score: number }

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

function search(index: DocIndexEntry[], q: string): Result[] {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  const out: Result[] = [];
  for (const p of index) {
    if (!tokens.length) { out.push({ key: p.slug, kind: "page", title: p.title, context: p.group, url: p.url, score: 0 }); continue; }
    const title = norm(p.title), kw = norm(p.keywords.join(" ")), body = norm(`${p.description} ${p.excerpt}`);
    let pageScore = 0, pageOk = true;
    for (const t of tokens) {
      const s = title.startsWith(t) ? 100 : title.includes(t) ? 70 : kw.includes(t) ? 45 : body.includes(t) ? 15 : 0;
      if (!s) { pageOk = false; break; }
      pageScore += s;
    }
    if (pageOk) out.push({ key: p.slug, kind: "page", title: p.title, context: p.group, url: p.url, score: pageScore });
    for (const sec of p.sections) {
      const st = norm(sec.title);
      if (tokens.every((t) => st.includes(t))) {
        out.push({ key: `${p.slug}#${sec.id}`, kind: "section", title: sec.title, context: p.title, url: `${p.url}#${sec.id}`, score: 50 + (st.startsWith(tokens[0]) ? 10 : 0) });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, tokens.length ? 24 : 40);
}

/** ⌘K command palette: accessible modal dialog with a combobox, grouped results, focus trap. */
export default function SearchPalette({ index, open, onClose }: { index: DocIndexEntry[]; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const uid = useId();

  const results = useMemo(() => search(index, query), [index, query]);
  const pages = results.filter((r) => r.kind === "page");
  const sections = results.filter((r) => r.kind === "section");
  const flat = [...pages, ...sections];

  // Mount on open, play the (shorter) exit on close.
  useEffect(() => {
    let t: number | undefined;
    const raf = requestAnimationFrame(() => {
      if (open) { lastFocus.current = document.activeElement as HTMLElement | null; setMounted(true); setClosing(false); setQuery(""); setActive(0); }
      else if (mounted) { setClosing(true); t = window.setTimeout(() => { setMounted(false); setClosing(false); lastFocus.current?.focus?.(); }, 130); }
    });
    return () => { cancelAnimationFrame(raf); if (t) window.clearTimeout(t); };
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted || closing) return;
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mounted, closing]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = useCallback((r: Result | undefined) => {
    if (!r) return;
    window.location.href = asset(r.url);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (flat.length ? (a + 1) % flat.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(flat[active]); }
    else if (e.key === "Tab") { e.preventDefault(); input.current?.focus(); } // focus trap: the input is the only stop
  };

  if (!mounted) return null;
  const optId = (i: number) => `${uid}-opt-${i}`;
  const renderGroup = (label: string, items: Result[], offset: number) => items.length === 0 ? null : (
    <div role="group" aria-label={label} key={label}>
      <div className="dx-pal-group" aria-hidden="true">{label}</div>
      {items.map((r, k) => {
        const i = offset + k;
        return (
          <a key={r.key} id={optId(i)} data-i={i} data-testid="docs-search-result" role="option" aria-selected={i === active} className="dx-pal-item" href={asset(r.url)} tabIndex={-1}
            onMouseMove={() => setActive(i)} onClick={(e) => { e.preventDefault(); go(r); }}>
            {r.kind === "page" ? <FileText size={16} aria-hidden="true" /> : <Hash size={16} aria-hidden="true" />}
            <span className="dx-pal-title">{r.title}</span>
            <span className="dx-pal-ctx">{r.context}</span>
            {i === active && <CornerDownLeft size={14} aria-hidden="true" className="dx-pal-enter" />}
          </a>
        );
      })}
    </div>
  );

  return (
    <div className="dx-pal" data-closing={closing} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dx-pal-panel" role="dialog" aria-modal="true" aria-label="Search the docs" onKeyDown={onKeyDown}>
        <input
          ref={input} className="dx-pal-input" type="text" data-testid="docs-search-input" role="combobox" aria-expanded="true" aria-controls={`${uid}-list`}
          aria-activedescendant={flat.length ? optId(active) : undefined} aria-autocomplete="list" autoComplete="off" spellCheck={false}
          placeholder="Search pages, sections and keywords" aria-label="Search the docs" value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        />
        <div className="dx-pal-list" id={`${uid}-list`} role="listbox" aria-label="Results" ref={list}>
          {renderGroup("Pages", pages, 0)}
          {renderGroup("Sections", sections, pages.length)}
          {flat.length === 0 && <p className="dx-pal-empty">No results for &ldquo;{query}&rdquo;.</p>}
        </div>
        <div className="dx-pal-foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
        <span className="sr-only" aria-live="polite">{flat.length} results</span>
      </div>
    </div>
  );
}
