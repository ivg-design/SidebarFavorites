"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { asset, REPO_URL } from "@/lib/config";
import { useHeroBus } from "./hero-bus";

const LINKS = [
  ["How it works", "#how"], ["Custom icons", "#custom"], ["Everywhere", "#everywhere"],
  ["Both icons", "#both"], ["Under the hood", "#hood"], ["Install", "#install"],
] as const;

export default function Header() {
  const { fireEgg } = useHeroBus();
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const clicks = useRef<number[]>([]);

  useEffect(() => {
    const on = () => setStuck(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Easter egg: five clicks on the icon within 2.5 s.
  const onIcon = () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 2500), now];
    if (clicks.current.length >= 5) { clicks.current = []; fireEgg(); }
  };

  return (
    <header className="nav" data-stuck={stuck}>
      <div className="wrap nav-in">
        <span className="brand">
          <button type="button" className="brand-icon" onClick={onIcon} aria-label="SidebarFavorites app icon">
            <Image src={asset("/images/icon-64.png")} alt="" width={36} height={36} priority />
          </button>
          <a href={asset("/")}>SidebarFavorites</a>
        </span>
        <nav className="nav-links" aria-label="Page sections">
          {LINKS.slice(0, 5).map(([l, h]) => <a key={h} href={h}>{l}</a>)}
          <a href={asset("/docs")}>Docs</a>
          <a href="#install">Install</a>
        </nav>
        <div className="nav-right">
          <a className="gh" href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          <a className="btn btn-ink" href="#install">Install</a>
          <button type="button" className="menu-btn" aria-expanded={open} aria-controls="mnav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mnav" className="menu-panel" aria-label="Page sections">
          {LINKS.map(([l, h]) => <a key={h} href={h} onClick={() => setOpen(false)}>{l}</a>)}
          <a href={asset("/docs")}>Docs</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        </nav>
      )}
    </header>
  );
}
