"use client";
import { useEffect, useRef, useState } from "react";
import { FolderGlyph } from "../finder/Finder";
import { Glyph } from "../glyphs";

/** A sidebar row's glyph that cross-dissolves whenever `name` changes ("folder" = the grey default). Two stacked layers alternate. */
export default function RowGlyph({ name, duration = 420 }: { name: string; duration?: number }) {
  const [layers, setLayers] = useState<{ a: string; b: string; showB: boolean }>({ a: name, b: name, showB: false });
  const current = useRef(name);
  useEffect(() => {
    if (current.current === name) return;
    current.current = name;
    setLayers((l) => (l.showB ? { a: name, b: l.b, showB: false } : { a: l.a, b: name, showB: true }));
  }, [name]);
  const draw = (n: string) => (n === "folder" ? <FolderGlyph /> : <Glyph name={n} size={16} />);
  const t = `opacity ${duration}ms var(--ease-quint), filter ${duration}ms var(--ease-quint)`;
  return (
    <span className="hx-rg" data-glyph={name} aria-hidden="true">
      <span className="hx-rg-l" style={{ opacity: layers.showB ? 0 : 1, filter: layers.showB ? "blur(1.5px)" : "none", transition: t }}>{draw(layers.a)}</span>
      <span className="hx-rg-l" style={{ opacity: layers.showB ? 1 : 0, filter: layers.showB ? "none" : "blur(1.5px)", transition: t }}>{draw(layers.b)}</span>
    </span>
  );
}
