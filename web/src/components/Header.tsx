"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { asset, REPO_URL } from "@/lib/config";

const LINKS = [
  ["How it works", "#how"], ["Custom icons", "#custom"], ["Everywhere", "#everywhere"],
  ["Both icons", "#both"], ["Under the hood", "#hood"], ["Install", "#install"],
] as const;

export default function Header() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setStuck(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className="nav" data-stuck={stuck}>
      <div className="wrap nav-in">
        <a className="brand" href={asset("/")} aria-label="SidebarFavorites, back to top">
          <span className="brand-icon">
            <Image src={asset("/images/icon-64.png")} alt="" width={36} height={36} priority />
          </span>
          <span>SidebarFavorites</span>
        </a>
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
