"use client";
// One flat silhouette: the SVG as a CSS mask over currentColor, the app's own flattening. When the mask changes
// the new one resolves over the old (a 420 ms cross-dissolve, see custom.css). Nothing scales.
import { useEffect, useState } from "react";

interface Layer { k: number; mask: string }

export default function Silhouette({ mask, px, testId }: { mask: string; px: number; testId?: string }) {
  const [layers, setLayers] = useState<Layer[]>([{ k: 0, mask }]);
  const top = layers[layers.length - 1];
  if (top.mask !== mask) setLayers([top, { k: top.k + 1, mask }]);
  useEffect(() => {
    if (layers.length < 2) return;
    const t = setTimeout(() => setLayers((l) => l.slice(-1)), 460);
    return () => clearTimeout(t);
  }, [layers]);
  return (
    <span className="cx-sil" style={{ width: px, height: px }} data-testid={testId}>
      {layers.map((l, i) => (
        <span
          key={l.k} className="cx-layer cx-layer-mask" data-state={layers.length === 1 ? "rest" : i === 0 ? "old" : "new"}
          style={{ maskImage: l.mask, WebkitMaskImage: l.mask }}
        />
      ))}
    </span>
  );
}
