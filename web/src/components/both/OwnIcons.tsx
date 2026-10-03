import { FolderIcon } from "../finder/Finder";
import { Glyph } from "../glyphs";

/** The pane's blue folder carrying its own icon: a star on the front flap. */
export function OwnFolderIcon() {
  return <FolderIcon badge={<Glyph name="star.fill" size={22} />} />;
}

/** 16 px starred blue folder: what Finder draws in the sidebar when it redraws the row from the folder's own icon. */
export function OwnFolderRow() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <defs>
        <linearGradient id="bx-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#74BBFF" /><stop offset="1" stopColor="#3D8AF0" /></linearGradient>
      </defs>
      <path d="M1 3.6A1.6 1.6 0 0 1 2.6 2h3.1c.4 0 .8.15 1.1.43l.7.7c.13.13.3.2.5.2h4.4A1.6 1.6 0 0 1 14 4.93v7.47A1.6 1.6 0 0 1 12.4 14H2.6A1.6 1.6 0 0 1 1 12.4V3.6Z" fill="url(#bx-f)" />
      <path d="M8 6.4l.95 1.93 2.1.3-1.52 1.48.36 2.09L8 11.2l-1.89.99.36-2.09L4.95 8.63l2.1-.3L8 6.4Z" fill="rgba(10,40,96,.75)" />
    </svg>
  );
}
