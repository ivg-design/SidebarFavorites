"use client";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { Cloud, Folder, HardDrive, Server } from "lucide-react";
import { Reveal } from "./motion/Reveal";
import { Vivid } from "./finder/Finder";
import EvSidebar from "./everywhere/EvSidebar";
import { KINDS, LOC_OFF, LOC_ON, LOC_OWN, NOTES, ROWS, type Kind } from "./everywhere/data";
import { nb } from "@/lib/nowrap";
import "@/app/everywhere.css";

const ICONS = { local: Folder, cloud: Cloud, disk: HardDrive, share: Server } as const;
const START = new Set(ROWS.filter((r) => r.kind === "local" && r.glyph).map((r) => r.key));

export default function Everywhere() {
  const uid = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [kind, setKind] = useState<Kind>("local");
  const [iconed, setIconed] = useState<Set<string>>(START);
  const [locOnly, setLocOnly] = useState({ disk: false, share: false });
  const idx = KINDS.findIndex((k) => k.kind === kind);
  const volume = kind === "disk" || kind === "share";

  const choose = useCallback((i: number, focus = false) => {
    const k = KINDS[i].kind;
    setKind(k);
    // rows of the chosen kind gain their glyph (the grey default dissolves into it)
    setIconed((s) => { const n = new Set(s); ROWS.forEach((r) => { if (r.kind === k && r.glyph) n.add(r.key); }); return n; });
    if (focus) tabs.current[i]?.focus();
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const n = KINDS.length;
    const next = ({ ArrowDown: idx + 1, ArrowRight: idx + 1, ArrowUp: idx - 1, ArrowLeft: idx - 1, Home: 0, End: n - 1 } as Record<string, number>)[e.key];
    if (next === undefined) return;
    e.preventDefault();
    choose((next + n) % n, true);
  };

  const only = volume ? locOnly[kind as "disk" | "share"] : false;

  return (
    <section id="everywhere" className="sec-beat sec-wash ev">
      <div className="wrap">
        <Reveal>
          <div className="sec-head">
            <p className="eyebrow">Everywhere Finder goes</p>
            <h2 className="h2">Local, cloud, disks, shares.</h2>
            <p className="lede">{nb("Folders in iCloud Drive and ~/Library/CloudStorage work exactly like local ones (that did not work before 1.0: they are virtual FileProvider mounts a Finder Sync extension cannot see). A mounted disk or server can carry a custom icon too.")}</p>
          </div>
        </Reveal>
        <div className="cols cols-even ev-cols">
          <Reveal>
            <Vivid className="ev-panel"><EvSidebar kind={kind} iconed={iconed} locOnly={locOnly} /></Vivid>
          </Reveal>
          <Reveal delay={0.06}>
            <div role="tablist" aria-label="Where favorites can live" aria-orientation="vertical" className="ev-tabs" onKeyDown={onKey}>
              {KINDS.map((k, i) => {
                const Ic = ICONS[k.kind];
                return (
                  <button
                    key={k.kind} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`${uid}-t${i}`}
                    aria-selected={k.kind === kind} aria-controls={`${uid}-p`} tabIndex={k.kind === kind ? 0 : -1}
                    data-testid={`ev-kind-${k.kind}`} className="ev-tab" onClick={() => choose(i)}
                  >
                    <Ic size={22} strokeWidth={1.6} aria-hidden="true" />
                    <span className="ev-tab-t"><b>{k.label}</b><small>{k.sub}</small></span>
                  </button>
                );
              })}
            </div>
            <div role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-t${idx}`} className="ev-panel-r">
              <p className="prose ev-note" data-testid="ev-note" aria-live="polite">
                {NOTES[kind]}{volume && <> {only ? LOC_ON : LOC_OFF}</>}
              </p>
              <div className="ev-collapse ev-sw-wrap" data-open={volume} aria-hidden={!volume}>
                <div className="ev-collapse-in">
                  <div className="ev-sw-box">
                    <button
                      type="button" role="switch" aria-checked={only} id={`${uid}-sw`} tabIndex={volume ? 0 : -1}
                      className="ev-sw" data-testid="ev-locations-only"
                      onClick={() => setLocOnly((s) => ({ ...s, [kind]: !s[kind as "disk" | "share"] }))}
                    >
                      <span className="ev-sw-track" aria-hidden="true"><i /></span>
                      <span className="ev-sw-l">Show in Locations only</span>
                    </button>
                    <p className="fine">{LOC_OWN}</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
