"use client";
import { Fragment, useState } from "react";
import { HOOD_NODES, type HoodKey } from "./nodes";
import { nb } from "@/lib/nowrap";

const ROOT = "~/Library/Application Support/SidebarFavorites/";

function Guides({ guides, elbow }: { guides: string; elbow: "t" | "l" }) {
  return (
    <span className="uh-guides" aria-hidden="true">
      {guides.split("").map((g, i) => <span key={i} className="uh-g" data-pipe={g === "|"} />)}
      <span className="uh-g uh-elbow" data-el={elbow} />
    </span>
  );
}

/** The annotated bundle listing. Choosing a line explains it in the side panel. */
export default function HoodTree() {
  const [sel, setSel] = useState<HoodKey>("exec");
  const node = HOOD_NODES.find((n) => n.key === sel)!;
  return (
    <div className="uh-tree-wrap">
      <div className="uh-tree mono" role="group" aria-label="Bundle listing. Choose a line to read what it does.">
        <p className="uh-root">{ROOT}</p>
        {HOOD_NODES.map((n) => (
          <Fragment key={n.key}>
            {n.key === "plist" && (
              <div className="uh-ln uh-static"><Guides guides="|" elbow="l" /><span className="uh-dir">Contents/</span></div>
            )}
            <div className="uh-ln">
              <Guides guides={n.guides} elbow={n.elbow} />
              <button type="button" className="uh-node" aria-pressed={sel === n.key} data-testid={`uh-node-${n.key}`} onClick={() => setSel(n.key)}>
                <span className="uh-name">{n.name.split("/").map((seg, i, a) => <Fragment key={i}>{seg}{i < a.length - 1 && <>/<wbr /></>}</Fragment>)}</span><span className="uh-note">{nb(n.note)}</span>
              </button>
            </div>
          </Fragment>
        ))}
      </div>
      <div className="uh-panel" data-testid="uh-panel" aria-live="polite" aria-atomic="true">
        <div key={node.key} className="uh-panel-in">
          <p className="uh-panel-k mono">{node.title}</p>
          {node.body.map((b, i) => <p key={i}>{typeof b === "string" ? nb(b) : b}</p>)}
        </div>
      </div>
    </div>
  );
}
