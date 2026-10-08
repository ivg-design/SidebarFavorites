"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Search } from "lucide-react";
import { asset, REPO_URL } from "@/lib/config";
import type { DocIndexEntry } from "@/content/docs/types";
import SearchPalette from "./SearchPalette";

/** Sticky docs/changelog bar: brand, centred search field (⌘K / Ctrl+K), links. Owns the palette. */
export default function TopBar({ index, current }: { index: DocIndexEntry[]; current?: "changelog" }) {
  const [open, setOpen] = useState(false);
  const [mac, setMac] = useState(true);
  // The palette is portalled to <body>: `.dx-top` has a backdrop-filter, which makes it the containing block for
  // fixed-position descendants, so a palette rendered inside it was confined to the bar - a grey band, no input.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
      setMounted(true);
    });
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <header className="dx-top">
      <div className="dx-top-in">
        <div className="dx-brand">
          <a className="dx-brand-home" href={asset("/")} title="Home">
            <Image src={asset("/images/icon-180.png")} alt="" width={54} height={54} priority unoptimized />
            <span className="dx-brand-name">SidebarFavorites <span className="dx-brand-docs"><span aria-hidden="true">/ </span>Docs</span></span>
          </a>
        </div>
        <button type="button" className="dx-search" data-testid="docs-search-open" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-keyshortcuts="Meta+K" aria-label="Search docs">
          <Search size={16} aria-hidden="true" />
          <span className="dx-search-label">Search docs…</span>
          <kbd>{mac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
        <nav className="dx-top-links" aria-label="Site">
          <a href={asset("/")}>Home</a>
          <a href={asset("/changelog")} aria-current={current === "changelog" ? "page" : undefined}>Changelog</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        </nav>
      </div>
      {mounted && createPortal(<SearchPalette index={index} open={open} onClose={() => setOpen(false)} />, document.body)}
    </header>
  );
}
