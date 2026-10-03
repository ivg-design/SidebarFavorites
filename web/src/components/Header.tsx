"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { asset, REPO_URL } from "@/lib/config";
import "@/app/nav.css";

const SECTIONS = [
  { id: "how", label: "How it works" },
  { id: "custom", label: "Custom icons" },
  { id: "everywhere", label: "Everywhere" },
  { id: "both", label: "Both icons" },
  { id: "hood", label: "Under the hood" },
] as const;

const home = (id: string) => `${asset("/")}#${id}`;

export default function Header() {
  const [stuck, setStuck] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // hairline once scrolled
  useEffect(() => {
    const on = () => setStuck(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // section in view
  useEffect(() => {
    const els = [...SECTIONS.map((s) => s.id), "install"].map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id === "install" ? null : e.target.id);
          else setActive((cur) => (cur === e.target.id && e.boundingClientRect.top > 0 ? null : cur));
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // slide the underline under the active link (transform only)
  const place = useCallback(() => {
    const bar = barRef.current, list = listRef.current;
    if (!bar || !list) return;
    const a = active ? list.querySelector<HTMLElement>(`[data-id="${active}"]`) : null;
    if (!a || !a.offsetWidth) { bar.dataset.on = "false"; return; }
    const pad = parseFloat(getComputedStyle(a).paddingLeft) || 0;
    bar.style.transform = `translateX(${a.offsetLeft + pad}px) scaleX(${a.offsetWidth - 2 * pad})`;
    bar.dataset.on = "true";
  }, [active]);
  useEffect(() => {
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) menuBtn.current?.focus();
  }, []);

  // menu: Escape, scroll lock, wide-screen reset, outside click
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(true); };
    const mq = window.matchMedia("(min-width: 1100px)");
    const wide = () => { if (mq.matches) setOpen(false); };
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !menuBtn.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    mq.addEventListener("change", wide);
    return () => {
      html.style.overflow = prev;
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", down);
      mq.removeEventListener("change", wide);
    };
  }, [open, close]);

  return (
    <header className="nav" data-stuck={stuck} data-testid="header">
      <div className="wrap nav-in">
        <a className="nav-brand" href={asset("/")} aria-label="SidebarFavorites home">
          <Image src={asset("/images/icon-64.png")} alt="" width={54} height={54} priority />
          <span>SidebarFavorites</span>
        </a>

        <nav className="nav-links" aria-label="Sections" ref={listRef}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={home(s.id)} data-id={s.id} data-testid={`hd-link-${s.id}`} aria-current={active === s.id ? "true" : undefined}>
              {s.label}
            </a>
          ))}
          <span className="nav-bar" ref={barRef} data-on="false" aria-hidden="true" />
        </nav>

        <div className="nav-end">
          <a className="nav-plain nav-wide" href={asset("/docs")} data-testid="hd-link-docs">Docs</a>
          <a className="nav-plain nav-wide" href={REPO_URL} target="_blank" rel="noopener noreferrer" data-testid="hd-link-github">
            GitHub <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a className="btn btn-primary btn-sm" href={home("install")} data-testid="hd-install">Install</a>
          <button
            ref={menuBtn}
            type="button"
            className="nav-menu"
            aria-expanded={open}
            aria-controls="nav-panel"
            aria-label={open ? "Close menu" : "Open menu"}
            data-testid="hd-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="nav-burger" aria-hidden="true"><i /><i /></span>
          </button>
        </div>
      </div>

      <div id="nav-panel" className="nav-panel" ref={panelRef} hidden={!open} data-testid="hd-panel">
        <nav className="wrap nav-panel-in" aria-label="Menu">
          {SECTIONS.map((s) => (
            <a key={s.id} href={home(s.id)} aria-current={active === s.id ? "true" : undefined} onClick={() => close(false)}>{s.label}</a>
          ))}
          <a href={asset("/docs")} onClick={() => close(false)}>Docs</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" onClick={() => close(false)}>
            GitHub <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
