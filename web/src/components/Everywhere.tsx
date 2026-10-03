"use client";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { Cloud, Folder, HardDrive, Server } from "lucide-react";
import { Reveal } from "./motion/Reveal";
import { Flip } from "./flip/Flip";
import { Glyph } from "./glyphs";
import { Sidebar, SideHeading, SideRow } from "./finder/Finder";
import "./finder/finder.css";
import { nb } from "@/lib/nowrap";
import "@/app/flow.css";

const ADVANCE_MS = 3000;

const TABS = [
  { icon: Folder, label: "Local folders", word: "Local folders.", text: nb("Anything on your Mac. ~ paths welcome.") },
  { icon: Cloud, label: "iCloud & CloudStorage", word: "Cloud folders.", text: nb("Google Drive, Dropbox and OneDrive live in virtual File Provider folders that older tools could not reach. SidebarFavorites can.") },
  { icon: HardDrive, label: "Mounted disks", word: "Mounted disks.", text: nb("Finder already lists them under Locations; the app icons that row, or adds a Favorites row too.") },
  { icon: Server, label: "Network shares", word: "Network shares.", text: nb("Same as disks. Finder keeps owning the Locations row; the app only patches it in place.") },
] as const;

interface Row { key: string; label: string; glyph: string; tab: number; custom: boolean }
const SECTIONS: { heading: string; rows: Row[] }[] = [
  { heading: "Favorites", rows: [
    { key: "desktop", label: "Desktop", glyph: "desktopcomputer", tab: 0, custom: true },
    { key: "projects", label: "Projects", glyph: "hammer.fill", tab: 0, custom: true },
    { key: "invoices", label: "Invoices", glyph: "doc.text.magnifyingglass", tab: 0, custom: true },
  ] },
  { heading: "iCloud", rows: [
    { key: "icloud-drive", label: "iCloud Drive", glyph: "icloud.and.arrow.up", tab: 1, custom: false },
    { key: "google-drive", label: "Google Drive", glyph: "icloud", tab: 1, custom: true },
    { key: "dropbox", label: "Dropbox", glyph: "archivebox.fill", tab: 1, custom: true },
    { key: "onedrive", label: "OneDrive", glyph: "globe", tab: 1, custom: true },
  ] },
  { heading: "Locations", rows: [
    { key: "work2tbssd", label: "WORK2TBSSD", glyph: "briefcase.fill", tab: 2, custom: true },
    { key: "studio-nas", label: "Studio NAS", glyph: "externaldrive.connected.to.line.below", tab: 3, custom: true },
    { key: "network", label: "Network", glyph: "globe", tab: 3, custom: false },
  ] },
];

function Eject() {
  return (
    <svg className="eject" width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 1.5 10.2 7H1.8L6 1.5Z" /><rect x="1.8" y="8.4" width="8.4" height="1.6" rx=".6" />
    </svg>
  );
}

export default function Everywhere() {
  const uid = useId();
  const reduce = !!useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onScreen = useInView(stage, { amount: 0.3 });
  const [sel, setSel] = useState(0);
  const [picked, setPicked] = useState(false);
  const auto = onScreen && !picked && !reduce;

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setSel((s) => (s + 1) % TABS.length), ADVANCE_MS);
    return () => clearTimeout(t);
  }, [auto, sel]);

  const choose = useCallback((i: number, focus = false) => {
    setPicked(true);
    setSel(i);
    if (focus) tabRefs.current[i]?.focus();
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const n = TABS.length;
    const next = { ArrowDown: sel + 1, ArrowRight: sel + 1, ArrowUp: sel - 1, ArrowLeft: sel - 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    choose((next + n) % n, true);
  };

  return (
    <section id="everywhere" className="sec sec-sidebar ev">
      <div className="wrap">
        <Reveal>
          <p className="eyebrow">Everywhere Finder goes</p>
          <h2 className="display h-sec">Local, cloud, disks, shares.</h2>
        </Reveal>
        <div className="ev-stage" ref={stage}>
          <Reveal className="ev-panel-wrap">
            <div className="vivid ev-panel">
              <Sidebar className="ev-side" data-testid="everywhere-sidebar">
                {SECTIONS.map((s) => (
                  <div key={s.heading}>
                    <SideHeading>{s.heading}</SideHeading>
                    {s.rows.map((r) => (
                      <SideRow
                        key={r.key} data-testid={`everywhere-row-${r.key}`} selected={r.custom && r.tab === sel} custom={r.custom}
                        icon={<Glyph name={r.glyph} size={16} strokeWidth={1.6} />} label={r.label} tabIndex={-1}
                        trailing={r.key === "work2tbssd" ? <Eject /> : undefined} type="button" onClick={() => choose(r.tab)}
                      />
                    ))}
                  </div>
                ))}
              </Sidebar>
              <div className="ev-col">
                <Flip as="div" className="ev-word" text={TABS[sel].word} data-testid="everywhere-word" />
              </div>
            </div>
          </Reveal>
          <Reveal className="ev-tabs-wrap" delay={0.06}>
            <div role="tablist" aria-label="Where favorites can live" aria-orientation="vertical" className="ev-tabs" onKeyDown={onKey}>
              {TABS.map((t, i) => (
                <button
                  key={t.label} ref={(el) => { tabRefs.current[i] = el; }} type="button" role="tab" id={`${uid}-t${i}`}
                  aria-selected={i === sel} aria-controls={`${uid}-p`} tabIndex={i === sel ? 0 : -1}
                  data-testid={`everywhere-tab-${i}`} className="ev-tab" onClick={() => choose(i)}
                >
                  <t.icon size={22} strokeWidth={1.6} aria-hidden="true" />
                  <span>{t.label}</span>
                  {i === sel && auto && <i className="ev-bar" key={`b${sel}`} aria-hidden="true" />}
                </button>
              ))}
            </div>
            <p role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-t${sel}`} className="ev-desc" data-testid="everywhere-desc" key={sel}>{TABS[sel].text}</p>
          </Reveal>
        </div>
        <Reveal><p className="fine ev-fine">{nb("Finder’s own synthesised rows — iCloud Drive, Computer, AirDrop, Network, the cloud-provider rows — cannot take a custom icon at all; macOS stores one and never draws it, so the app leaves them alone.")}</p></Reveal>
      </div>
    </section>
  );
}
