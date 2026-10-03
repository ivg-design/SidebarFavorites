"use client";
import { useId, type ReactNode, type ComponentPropsWithoutRef } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Search, Share, Tag, ChevronDown } from "lucide-react";
import { Glyph } from "../glyphs";
import "./finder.css";

/** The default grey "folder" sidebar glyph (SF `folder`, 16px). */
export function FolderGlyph({ className }: { className?: string }) {
  return (
    <svg className={`mac-folder ${className ?? ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1.5 4.25A1.75 1.75 0 0 1 3.25 2.5h2.9c.45 0 .88.17 1.2.48l.84.84c.14.14.33.22.53.22h4.03c.97 0 1.75.78 1.75 1.75v6.46a1.75 1.75 0 0 1-1.75 1.75H3.25a1.75 1.75 0 0 1-1.75-1.75V4.25Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/** The blue macOS folder icon for the pane (icon view), 60×48. `badge` draws a glyph on the front flap (a folder with an icon of its own). */
export function FolderIcon({ badge }: { badge?: ReactNode }) {
  const id = useId(); // gradient ids must be unique per instance: a hidden copy elsewhere would otherwise win
  const front = `${id}-front`, back = `${id}-back`;
  return (
    <span className="mac-folder-ic" aria-hidden="true" style={{ position: "relative" }}>
      <svg viewBox="0 0 60 48" width="60" height="48" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={front} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#74BBFF" /><stop offset="1" stopColor="#3D8AF0" /></linearGradient>
          <linearGradient id={back} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4A95F0" /><stop offset="1" stopColor="#2F74D6" /></linearGradient>
        </defs>
        <path d="M3 8a4 4 0 0 1 4-4h12.5a4 4 0 0 1 2.8 1.2L25 8h28a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" fill={`url(#${back})`} />
        <path d="M3 15a3 3 0 0 1 3-3h48a3 3 0 0 1 3 3v25a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V15Z" fill={`url(#${front})`} />
        <path d="M3 15a3 3 0 0 1 3-3h48a3 3 0 0 1 3 3v1H3v-1Z" fill="rgba(255,255,255,.28)" />
      </svg>
      {badge && <span className="badge" style={{ position: "absolute", left: "50%", top: "58%", transform: "translate(-50%,-50%)", display: "grid" }}>{badge}</span>}
    </span>
  );
}

/** Grey folder → glyph, the product's one move. `on` false shows the folder; true shows `glyph`. */
export function Morph({ glyph, on, className }: { glyph: string; on: boolean; className?: string }) {
  return (
    <span className={`mac-morph ${className ?? ""}`} data-on={on} aria-hidden="true">
      <span className="from" style={{ display: "grid" }}><FolderGlyph /></span>
      <span className="to" style={{ display: "grid" }}><Glyph name={glyph} size={16} /></span>
    </span>
  );
}

export function Vivid({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={`vivid ${className ?? ""}`} {...rest}>{children}</div>;
}

/** Dark Finder window chrome at native metrics. Children go inside `.mac-body` (a Sidebar and a Pane). */
export function MacWindow({ title = "Projects", titleTestId, className, children, sideWidth, ...rest }: ComponentPropsWithoutRef<"div"> & { title?: string; titleTestId?: string; sideWidth?: number }) {
  return (
    <div className={`mac-win ${className ?? ""}`} {...rest}>
      <div className="mac-bar" aria-hidden="true">
        <span className="mac-lights"><i /><i /><i /></span>
        <span className="mac-nav"><span><ChevronLeft size={17} /></span><span><ChevronRight size={17} /></span></span>
        <span className="mac-title" data-testid={titleTestId}><span className="mac-title-ic"><Glyph name="folder.fill" size={15} /></span>{title}</span>
        <span className="mac-tools">
          <span><LayoutGrid size={14} /><ChevronDown size={10} style={{ marginLeft: 3 }} /></span>
          <span><Share size={14} /></span><span><Tag size={14} /></span><span><Search size={14} /></span>
        </span>
      </div>
      <div className="mac-body" style={sideWidth ? ({ ["--mac-side-w" as string]: `${sideWidth}px` }) : undefined}>{children}</div>
    </div>
  );
}

export function Sidebar({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={`mac-side ${className ?? ""}`} {...rest}>{children}</div>;
}
export function SideHeading({ children }: { children: ReactNode }) { return <div className="mac-side-h">{children}</div>; }

/** One sidebar row. Renders a <button> when onClick is given. */
export function SideRow({ icon, label, selected, trailing, className, ...rest }: {
  icon: ReactNode; label: ReactNode; selected?: boolean | "blue"; trailing?: ReactNode; className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "children">) {
  const inner = (<><span className="ic">{icon}</span><span className="lab">{label}</span>{trailing}</>);
  const cls = `mac-row ${className ?? ""}`;
  if (rest.onClick || rest.type === "button") return <button type="button" className={cls} data-sel={selected} {...rest}>{inner}</button>;
  return <div className={cls} data-sel={selected}>{inner}</div>;
}

export function Pane({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={`mac-pane ${className ?? ""}`} {...rest}>{children}</div>;
}
export function FolderTile({ label, selected, badge, custom, testId }: { label: string; selected?: boolean; badge?: ReactNode; custom?: ReactNode; testId?: string }) {
  return (
    <div className="mac-tile" data-sel={selected} data-testid={testId}>
      <span className="mac-tile-ic">{custom ?? <FolderIcon badge={badge} />}</span>
      <span className="lab">{label}</span>
    </div>
  );
}
