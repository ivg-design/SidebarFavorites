import type { ReactNode } from "react";
import { Glyph } from "../glyphs";

/**
 * The pane's blue folder (60x48), with its own gradient ids: the kit's FolderIcon shares ids with every
 * other instance on the page, and a gradient defined inside a display:none copy (the hero's phone variant)
 * makes the fills vanish. `badge` draws the folder's own icon on the front flap.
 */
export function PaneFolder({ badge }: { badge?: ReactNode }) {
  return (
    <span className="mac-folder-ic" aria-hidden="true" style={{ position: "relative" }}>
      <svg viewBox="0 0 60 48" width="60" height="48" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="bx-ff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#74BBFF" /><stop offset="1" stopColor="#3D8AF0" /></linearGradient>
          <linearGradient id="bx-fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4A95F0" /><stop offset="1" stopColor="#2F74D6" /></linearGradient>
        </defs>
        <path d="M3 8a4 4 0 0 1 4-4h12.5a4 4 0 0 1 2.8 1.2L25 8h28a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Z" fill="url(#bx-fb)" />
        <path d="M3 15a3 3 0 0 1 3-3h48a3 3 0 0 1 3 3v25a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V15Z" fill="url(#bx-ff)" />
        <path d="M3 15a3 3 0 0 1 3-3h48a3 3 0 0 1 3 3v1H3v-1Z" fill="rgba(255,255,255,.28)" />
      </svg>
      {badge && <span className="badge" style={{ position: "absolute", left: "50%", top: "58%", transform: "translate(-50%,-50%)", display: "grid" }}>{badge}</span>}
    </span>
  );
}

/** The folder carrying its own icon: a star on the front flap. */
export function OwnFolderIcon() {
  return <PaneFolder badge={<Glyph name="star.fill" size={22} />} />;
}
