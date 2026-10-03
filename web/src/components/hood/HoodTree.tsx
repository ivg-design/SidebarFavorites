"use client";
import { Fragment, useRef, useState, type KeyboardEvent } from "react";
import { HOOD_NODES, type HoodKey } from "./nodes";
import { nb } from "@/lib/nowrap";

const ROOT = "~/Library/Application Support/SidebarFavorites/";

/** The tree the app writes. Choosing a node resolves the panel beside it to what is inside. */
export default function HoodTree() {
  const [sel, setSel] = useState<HoodKey>("exec");
  const tree = useRef<HTMLDivElement>(null);

  function onKey(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const btns = Array.from(tree.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    btns[(i + (e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length].focus();
  }

  return (
    <div className="uh-obj">
      <div className="uh-tree mono" ref={tree} role="group" aria-label="Files the app writes. Choose one to see what is inside." onKeyDown={onKey}>
        <p className="uh-root">{ROOT}</p>
        {HOOD_NODES.map((n) => (
          <Fragment key={n.key}>
            <button type="button" className="uh-node" data-depth={n.depth} aria-pressed={sel === n.key} aria-controls={`uh-pane-${n.key}`}
              data-testid={`uh-node-${n.key}`} onClick={() => setSel(n.key)}>
              <span className="uh-name">{n.name}</span>
              <span className="uh-note">{nb(n.note)}</span>
            </button>
          </Fragment>
        ))}
      </div>
      <div className="uh-panel" data-testid="uh-panel" aria-live="polite">
        {HOOD_NODES.map((n) => (
          <div key={n.key} id={`uh-pane-${n.key}`} className="uh-pane" data-on={sel === n.key} data-testid={`uh-pane-${n.key}`} aria-hidden={sel !== n.key}>
            <p className="uh-panel-k mono">{n.name}</p>
            <pre className="uh-peek mono">{n.peek.join("\n")}</pre>
            <p className="uh-panel-p">{nb(n.body)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
