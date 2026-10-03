"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { asset, basePath, REPO_URL } from "@/lib/config";
import { DOC_GROUPS, type DocIndexEntry } from "@/content/docs/types";
import TopBar from "./TopBar";

function currentSlug(pathname: string): string {
  let p = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  p = p.replace(/\/+$/, "");
  if (p === "/docs" || p === "") return "quick-start";
  return p.split("/").pop() ?? "quick-start";
}

function Nav({ index, slug }: { index: DocIndexEntry[]; slug: string }) {
  return (
    <nav aria-label="Documentation">
      {DOC_GROUPS.map((g) => (
        <div className="dx-group" key={g}>
          <h2 className="dx-group-title">{g}</h2>
          <ul>
            {index.filter((p) => p.group === g).map((p) => (
              <li key={p.slug}>
                <a href={asset(p.url)} aria-current={p.slug === slug ? "page" : undefined}>{p.navTitle ?? p.title}</a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Toc({ entry }: { entry: DocIndexEntry }) {
  const [active, setActive] = useState(entry.sections[0]?.id ?? "");
  useEffect(() => {
    const ids = entry.sections.map((s) => s.id);
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
  }, [entry]);

  return (
    <nav className="dx-toc-nav" aria-label="On this page">
      <h2 className="dx-toc-title">On this page</h2>
      <ul>
        {entry.sections.map((s) => (
          <li key={s.id}><a href={`#${s.id}`} aria-current={s.id === active ? "location" : undefined}>{s.title}</a></li>
        ))}
      </ul>
    </nav>
  );
}

export default function DocsShell({ index, children }: { index: DocIndexEntry[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const slug = currentSlug(pathname);
  const entry = useMemo(() => index.find((p) => p.slug === slug) ?? index[0], [index, slug]);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!picker) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPicker(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picker]);

  return (
    <div className="dx">
      <TopBar index={index} />
      <div className="dx-mnav">
        <button type="button" className="dx-mnav-btn" aria-expanded={picker} aria-controls="dx-mnav-panel" onClick={() => setPicker((o) => !o)}>
          <span><span className="dx-mnav-group">{entry.group}</span> <span aria-hidden="true">›</span> <b>{entry.navTitle ?? entry.title}</b></span>
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
        <aside className="dx-rail"><Nav index={index} slug={slug} /></aside>
        <div className="dx-main-wrap">{children}</div>
        <aside className="dx-toc" key={entry.slug}><Toc entry={entry} /></aside>
      </div>
    </div>
  );
}
