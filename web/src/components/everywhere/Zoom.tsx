"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const MAX_Z = 1.3; // one cap for every Finder mock on the site

/**
 * Scales a native-metric mock by transform only (never by changing its metrics).
 * `fixed`: the mock is `fixed` px wide natively; z fits the host between 1 and 1.3.
 * `flex`: the mock fills the host; z is 1.3 when the host is wide enough for `flex` native px, otherwise 1.
 */
export default function Zoom({ fixed, flex, className, style, children }: { fixed?: number; flex?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(1);
  const [h, setH] = useState<number | null>(null);

  useLayoutEffect(() => {
    const host = outer.current?.parentElement; if (!host) return;
    const fit = () => {
      const cs = getComputedStyle(host);
      const w = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setZ(fixed ? Math.max(1, Math.min(MAX_Z, w / fixed)) : (w / MAX_Z >= (flex ?? 0) ? MAX_Z : 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [fixed, flex]);

  useLayoutEffect(() => {
    const el = inner.current; if (!el) return;
    const m = () => setH(el.offsetHeight);
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className={className} style={{ ...style, width: fixed ? fixed * z : "100%", maxWidth: "100%", height: h ? h * z : undefined }}>
      <div ref={inner} className="mac-zoom" style={{ ["--z" as string]: z, width: fixed ? fixed : undefined }}>{children}</div>
    </div>
  );
}
