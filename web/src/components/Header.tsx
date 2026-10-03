"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { asset, REPO_URL } from "@/lib/config";
import RailList from "@/components/rail/RailList";

export default function Header() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const on = () => setStuck(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const wide = window.matchMedia("(min-width: 1180px)");
    const onWide = () => { if (wide.matches) setOpen(false); };
    window.addEventListener("keydown", key);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", key);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <header className="nav" data-stuck={stuck}>
      <div className="wrap nav-in">
        <a className="brand" href={asset("/")} aria-label="SidebarFavorites, back to top">
          <span className="brand-icon">
            <Image src={asset("/images/icon-64.png")} alt="" width={36} height={36} priority />
          </span>
          <span>SidebarFavorites</span>
        </a>
        <div className="hd-right">
          <nav className="hd-links" aria-label="Site">
            <a href={asset("/docs")}>Docs</a>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </nav>
          <a className="hd-gh" href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          <a className="btn btn-ink" href="#install" data-testid="hd-install">Install</a>
          <button ref={btn} type="button" className="hd-menu" data-testid="hd-menu" aria-expanded={open} aria-controls="hd-panel" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="hd-panel" className="hd-panel" data-testid="hd-panel" aria-label="Page sections">
          <RailList idPrefix="hd" onNavigate={() => setOpen(false)} />
        </nav>
      )}
    </header>
  );
}
