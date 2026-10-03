"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HardDrive, Server } from "lucide-react";
import { Glyph } from "../glyphs";
import { FolderGlyph, SideHeading, SideRow, Sidebar } from "../finder/Finder";
import { ROWS, type EvRow, type Kind, type Group } from "./data";

const NATIVE_W = 248;
const MAX_Z = 1.85;

function Eject() {
  return (
    <svg className="eject" width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 1.5 10.2 7H1.8L6 1.5Z" /><rect x="1.8" y="8.4" width="8.4" height="1.6" rx=".6" />
    </svg>
  );
}

function baseIcon(base: string): ReactNode {
  if (base === "folder") return <FolderGlyph />;
  if (base === "drive") return <HardDrive size={16} strokeWidth={1.6} aria-hidden="true" />;
  if (base === "server") return <Server size={16} strokeWidth={1.6} aria-hidden="true" />;
  return <Glyph name={base} size={16} />;
}

/** Default glyph → custom glyph cross-dissolve (same layers and classes as the kit's Morph, any base). */
function RowIcon({ row, on }: { row: EvRow; on: boolean }) {
  if (!row.glyph) return <span className="ev-ic">{baseIcon(row.base)}</span>;
  return (
    <span className="mac-morph" data-on={on} aria-hidden="true">
      <span className="from" style={{ display: "grid" }}>{baseIcon(row.base)}</span>
      <span className="to" style={{ display: "grid" }}><Glyph name={row.glyph} size={16} /></span>
    </span>
  );
}

export default function EvSidebar({ kind, iconed, locOnly }: { kind: Kind; iconed: Set<string>; locOnly: Record<"disk" | "share", boolean> }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(1);
  const [h, setH] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const host = el.parentElement!;
    const fit = () => {
      const cs = getComputedStyle(host);
      const w = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setZ(Math.max(1, Math.min(MAX_Z, w / NATIVE_W)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = inner.current; if (!el) return;
    const m = () => setH(el.offsetHeight);
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const groups: Group[] = ["Favorites", "iCloud", "Locations"];
  return (
    <div className="ev-fit" ref={box} style={{ width: NATIVE_W * z, height: h ? h * z : undefined }}>
      <div className="mac-zoom" style={{ ["--z" as string]: z, width: NATIVE_W }} ref={inner}>
        <div className="mac-win ev-win" data-testid="ev-sidebar">
          <div className="mac-bar ev-bar" aria-hidden="true"><span className="mac-lights"><i /><i /><i /></span></div>
          <Sidebar className="ev-side">
            {groups.map((g) => (
              <div key={g}>
                <SideHeading>{g}</SideHeading>
                {ROWS.filter((r) => r.group === g).map((r) => {
                  const hidden = !!r.favOf && locOnly[r.favOf];
                  const sel = r.kind === kind;
                  const on = !!r.glyph && iconed.has(r.key);
                  const tag = sel && r.own;
                  const row = (
                    <div className="ev-row" data-testid={`ev-row-${r.key}`} data-sel={sel} data-glyph={on ? r.glyph : r.base} data-own={r.own || undefined}>
                      <SideRow
                        selected={sel} icon={<RowIcon row={r} on={on} />} label={r.label}
                        trailing={tag ? <span className="ev-tag">Finder’s own row</span> : r.eject ? <Eject /> : undefined}
                      />
                    </div>
                  );
                  if (!r.favOf) return <div key={r.key}>{row}</div>;
                  return (
                    <div key={r.key} className="ev-collapse" data-open={!hidden} aria-hidden={hidden}>
                      <div className="ev-collapse-in">{row}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </Sidebar>
        </div>
      </div>
    </div>
  );
}
