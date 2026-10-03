import type { ReactNode, ComponentPropsWithoutRef } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Search, Tag, ListFilter } from "lucide-react";
import "./finder.css";

/** The default grey "folder" sidebar glyph (SF Symbol `folder`): outline, 16px. */
export function FolderGlyph({ className }: { className?: string }) {
  return (
    <svg className={`mac-folder ${className ?? ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1.5 4.25A1.75 1.75 0 0 1 3.25 2.5h2.9c.45 0 .88.17 1.2.48l.84.84c.14.14.33.22.53.22h4.03c.97 0 1.75.78 1.75 1.75v6.46a1.75 1.75 0 0 1-1.75 1.75H3.25a1.75 1.75 0 0 1-1.75-1.75V4.25Z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function Vivid({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={`vivid ${className ?? ""}`} {...rest}>{children}</div>;
}

/** Dark Finder window chrome. Pass the sidebar and pane as children of `.mac-body`. */
export function MacWindow({ title = "Projects", titleTestId, className, children, sideWidth, ...rest }: ComponentPropsWithoutRef<"div"> & { title?: string; titleTestId?: string; sideWidth?: number }) {
  return (
    <div className={`mac-win ${className ?? ""}`} {...rest}>
      <div className="mac-bar" aria-hidden="true">
        <span className="mac-lights"><i /><i /><i /></span>
        <span className="nav"><span><ChevronLeft size={16} /></span><span><ChevronRight size={16} /></span></span>
        <span className="title" data-testid={titleTestId}>{title}</span>
        <span className="tools"><span><LayoutGrid size={14} /></span><span><ListFilter size={14} /></span><span><Tag size={14} /></span><span><Search size={14} /></span></span>
      </div>
      <div className="mac-body" style={sideWidth ? ({ ["--mac-side-w" as string]: `${sideWidth}px` }) : undefined}>{children}</div>
    </div>
  );
}

export function Sidebar({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={`mac-side ${className ?? ""}`} {...rest}>{children}</div>;
}
export function SideHeading({ children }: { children: ReactNode }) { return <div className="mac-side-h">{children}</div>; }

/** One sidebar row. `icon` is the glyph node (FolderGlyph for the default). Renders a <button> when onClick is given. */
export function SideRow({ icon, label, selected, custom, trailing, className, ...rest }: {
  icon: ReactNode; label: ReactNode; selected?: boolean | "blue"; custom?: boolean; trailing?: ReactNode; className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "children">) {
  const inner = (<><span className={`ic${custom ? " custom" : ""}`}>{icon}</span><span className="lab">{label}</span>{trailing}</>);
  const cls = `mac-row ${className ?? ""}`;
  if (rest.onClick || rest.type === "button") return <button type="button" className={cls} data-sel={selected} {...rest}>{inner}</button>;
  return <div className={cls} data-sel={selected}>{inner}</div>;
}

export function Pane({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={`mac-pane ${className ?? ""}`} {...rest}>{children}</div>;
}
export function FolderTile({ label, selected, badge, custom }: { label: string; selected?: boolean; badge?: ReactNode; custom?: ReactNode }) {
  return (
    <div className="mac-tile" data-sel={selected}>
      {custom ? <span className="custom-folder">{custom}</span> : <span className="blue-folder">{badge && <span className="badge">{badge}</span>}</span>}
      <span className="lab">{label}</span>
    </div>
  );
}
