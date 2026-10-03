"use client";
import { useState, type ReactNode } from "react";
import { HardDrive, Plus, Server } from "lucide-react";
import { Reveal } from "./motion/Reveal";
import { FolderGlyph, SideHeading, SideRow, Sidebar, Vivid } from "./finder/Finder";
import { Glyph } from "./glyphs";
import Zoom from "./everywhere/Zoom";
import { ROWS, type EvRow } from "./everywhere/data";
import { nb } from "@/lib/nowrap";
import "@/app/everywhere.css";

function Eject() {
  return (
    <svg className="eject" width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 1.5 10.2 7H1.8L6 1.5Z" /><rect x="1.8" y="8.4" width="8.4" height="1.6" rx=".6" />
    </svg>
  );
}

function baseIcon(base: EvRow["base"]): ReactNode {
  if (base === "drive") return <HardDrive size={16} strokeWidth={1.6} aria-hidden="true" />;
  if (base === "server") return <Server size={16} strokeWidth={1.6} aria-hidden="true" />;
  return <FolderGlyph />;
}

/** macOS's default icon dissolves into the glyph the app applied (the kit's Morph layers, any base). */
function RowIcon({ row, on }: { row: EvRow; on: boolean }) {
  return (
    <span className="mac-morph" data-on={on} aria-hidden="true">
      <span className="from" style={{ display: "grid" }}>{baseIcon(row.base)}</span>
      <span className="to" style={{ display: "grid" }}><Glyph name={row.glyph} size={16} /></span>
    </span>
  );
}

const GROUPS = ["Favorites", "Locations"] as const;

export default function Everywhere() {
  const [sel, setSel] = useState("projects");
  const [seen, setSeen] = useState<Set<string>>(() => new Set(["projects"]));
  const [off, setOff] = useState<Set<string>>(() => new Set());
  const row = ROWS.find((r) => r.key === sel) ?? ROWS[0];
  const inSidebar = !off.has(row.key);

  const choose = (k: string) => { setSel(k); setSeen((s) => new Set(s).add(k)); };
  const toggle = () => setOff((s) => { const n = new Set(s); if (n.has(row.key)) n.delete(row.key); else n.add(row.key); return n; });

  return (
    <section id="everywhere" className="sec-beat ev">
      <div className="wrap">
        <Reveal className="ev-head">
          <h2 className="h2">Local, cloud, disks, shares.</h2>
          <p className="lede">{nb("Folders in iCloud Drive and ~/Library/CloudStorage work exactly like local ones. A mounted disk or server can carry a custom icon too.")}</p>
        </Reveal>

        <Vivid className="ev-stage">
          <Zoom fixed={248} className="ev-fit">
            <div className="mac-win ev-win" data-testid="ev-sidebar">
              <div className="mac-bar ev-bar" aria-hidden="true"><span className="mac-lights"><i /><i /><i /></span></div>
              <Sidebar className="ev-side">
                {GROUPS.map((g) => (
                  <div key={g} role="group" aria-label={g}>
                    <SideHeading>{g}</SideHeading>
                    {ROWS.filter((r) => r.group === g).map((r) => {
                      const gone = off.has(r.key);
                      return (
                        <div key={r.key} className="ev-collapse" data-open={!gone} aria-hidden={gone}>
                          <div className="ev-collapse-in">
                            <SideRow
                              type="button" selected={sel === r.key} label={r.label} tabIndex={gone ? -1 : 0}
                              icon={<RowIcon row={r} on={seen.has(r.key)} />}
                              trailing={r.kind === "disk" ? <Eject /> : undefined}
                              onClick={() => choose(r.key)}
                              aria-current={sel === r.key ? "true" : undefined}
                              data-testid={`ev-row-${r.key}`} data-glyph={seen.has(r.key) ? r.glyph : r.base} data-sel={sel === r.key}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </Sidebar>
            </div>
          </Zoom>

          <div className="ev-right">
            <Zoom flex={400} className="ev-fit-app">
              <div className="mac-win ev-app" data-testid="ev-panel" data-key={row.key} data-in={inSidebar}>
                <div className="ev-app-bar">
                  <span className="mac-lights" aria-hidden="true"><i /><i /><i /></span>
                </div>
                <div className="ev-app-head">
                  <span className="ev-app-title">Sidebar Favorites</span>
                  <span className="ev-app-plus" aria-hidden="true"><Plus size={18} strokeWidth={2.4} /></span>
                </div>
                <div className="ev-app-row">
                  <span className="ev-tile" aria-hidden="true">
                    <span key={row.key} className="ev-resolve"><Glyph name={row.glyph} size={26} /></span>
                  </span>
                  <span className="ev-meta" aria-live="polite" aria-atomic="true">
                    <span key={row.key} className="ev-resolve ev-meta-in">
                      <span className="ev-name" data-testid="ev-name">{row.label}</span>
                      <span className="ev-path" data-testid="ev-path"><span className="h">{row.head}</span><span className="t">{row.tail}</span></span>
                    </span>
                  </span>
                  <span className="ev-state" data-testid="ev-state"><i aria-hidden="true" />{inSidebar ? "In Sidebar" : "Not in Sidebar"}</span>
                  <button type="button" role="switch" aria-checked={inSidebar} aria-label={`${row.label} in Sidebar`} className="ev-sw" data-testid="ev-toggle" onClick={toggle}>
                    <span className="ev-track" aria-hidden="true"><i /></span>
                  </button>
                </div>
              </div>
            </Zoom>
          </div>
        </Vivid>
        <div className="ev-copy">
          <div>
            <p className="h3" data-testid="ev-where">{nb(row.where)}</p>
            <p className="prose" data-testid="ev-note" aria-live="polite">{nb(row.note)}</p>
          </div>
          <p className="fine">{nb("Finder’s own entries (iCloud Drive, Computer, AirDrop, Network and the cloud-provider rows) cannot take a custom icon: macOS stores one and never draws it, so the app leaves them alone.")}</p>
        </div>
      </div>
    </section>
  );
}
