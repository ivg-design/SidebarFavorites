import { FolderGlyph } from "../finder/Finder";
import { Glyph } from "../glyphs";

/** A sidebar glyph by SF Symbol name; "folder" is the grey default outline. */
export function MacGlyph({ name, size = 16, popKey }: { name: string; size?: number; popKey?: string }) {
  return (
    <span key={popKey ?? name} style={{ display: "grid" }}>
      {name === "folder" ? <FolderGlyph /> : <Glyph name={name} size={size} />}
    </span>
  );
}
