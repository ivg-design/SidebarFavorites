"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, Braces, ChevronDown, CircleHelp, Cloud, Copy, Cpu, Download, FileCode, Hammer, HardDrive, LifeBuoy, PanelTop, RectangleHorizontal, RefreshCw, Rocket, Snowflake, Trash2, type LucideIcon, SlidersHorizontal } from "lucide-react";
import { asset, basePath, REPO_URL } from "@/lib/config";
import { DOC_GROUPS, type DocIndexEntry } from "@/content/docs/types";
import TopBar from "./TopBar";

function currentSlug(pathname: string): string {
  let p = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  p = p.replace(/\/+$/, "");
  if (p === "/docs" || p === "") return "quick-start";
  return p.split("/").pop() ?? "quick-start";
}

/** One grey 16 px glyph per page, like a Finder Favorites row. */
const ICONS: Record<string, LucideIcon> = {
  "quick-start": Rocket, install: Download, updates: RefreshCw, "custom-svg-icons": FileCode, spacers: RectangleHorizontal, "cloud-folders": Cloud,
  "disks-and-shares": HardDrive, "keeping-both-icons": Copy, "menu-bar-popover": PanelTop, "how-it-works": Cpu,
  settings: SlidersHorizontal, "config-json": Braces, uninstalling: Trash2, "building-from-source": Hammer, "nix-flake": Snowflake,
  troubleshooting: LifeBuoy, faq: CircleHelp, "report-an-issue": Bug,
};

export interface TocItem { id: string; title: string }

function Nav({ index, slug }: { index: DocIndexEntry[]; slug: string }) {
  return (
    <nav aria-label="Documentation">
      {DOC_GROUPS.map((g) => (
        <div className="dx-group" key={g}>
          <h2 className="dx-group-title">{g}</h2>
          <ul>
            {index.filter((p) => p.group === g).map((p) => {
              const Icon = ICONS[p.slug] ?? FileCode;
              return (
              <li key={p.slug}>
                <a className="dx-row" href={asset(p.url)} aria-current={p.slug === slug ? "page" : undefined}>
                  <span className="dx-row-ic" aria-hidden="true"><Icon size={16} strokeWidth={1.75} /></span>
                  <span className="dx-row-lab">{p.navTitle ?? p.title}</span>
                </a>
              </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Toc({ sections, title }: { sections: TocItem[]; title: string }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  useEffect(() => {
    const ids = sections.map((s) => s.id);
    let frame = 0;
    const measure = () => {
      frame = 0;
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) cur = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = ids[ids.length - 1];
      setActive(cur);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    frame = requestAnimationFrame(measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { if (frame) cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [sections]);

  return (
    <nav className="dx-toc-nav" data-testid="docs-toc" aria-label="On this page">
      <h2 className="dx-toc-title">{title}</h2>
      <ul>
        {sections.map((s) => (
          <li key={s.id}><a href={`#${s.id}`} aria-current={s.id === active ? "location" : undefined}>{s.title}</a></li>
        ))}
      </ul>
    </nav>
  );
}

export default function DocsShell({ index, children, changelog }: { index: DocIndexEntry[]; children: React.ReactNode; changelog?: TocItem[] }) {
  const pathname = usePathname();
  const slug = changelog ? "" : currentSlug(pathname);
  const entry = useMemo(() => index.find((p) => p.slug === slug) ?? index[0], [index, slug]);
  const tocItems = changelog ?? entry.sections;
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!picker) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPicker(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picker]);

  return (
    <div className="dx">
      <TopBar index={index} current={changelog ? "changelog" : undefined} />
      <div className="dx-mnav">
        <button type="button" className="dx-mnav-btn" aria-expanded={picker} aria-controls="dx-mnav-panel" onClick={() => setPicker((o) => !o)}>
          {changelog
            ? <span><span className="dx-mnav-group">Site</span> <span aria-hidden="true">›</span> <b>Changelog</b></span>
            : <span><span className="dx-mnav-group">{entry.group}</span> <span aria-hidden="true">›</span> <b>{entry.navTitle ?? entry.title}</b></span>}
          <ChevronDown size={18} aria-hidden="true" />
        </button>
        {picker && (
          <div id="dx-mnav-panel" className="dx-mnav-panel">
            <Nav index={index} slug={slug} />
            <div className="dx-mnav-more">
              <a href={asset("/")}>Home</a><a href={asset("/changelog")}>Changelog</a><a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
            </div>
          </div>
        )}
      </div>
      <div className="dx-body">
        <aside className="dx-rail" aria-label="Documentation sidebar"><Nav index={index} slug={slug} /></aside>
        <div className="dx-main-wrap">{children}</div>
        <aside className="dx-toc" aria-label="Page contents" key={changelog ? "changelog" : entry.slug}><Toc sections={tocItems} title={changelog ? "Versions" : "On this page"} /></aside>
      </div>
    </div>
  );
}
