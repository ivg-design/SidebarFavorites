"use client";
// OWNER: worker D. Counts from `from` to `to` once when scrolled into view (600 ms, ease-out-quint).
// Reduced motion renders `to` immediately. No layout shift: the widest value sizes the box.
import { useEffect, useRef, useState } from "react";

const quint = (t: number) => 1 - Math.pow(1 - t, 5);

export default function CountUp({ to, from = 0, duration = 600 }: { to: number; from?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    let started = false;
    const io = new IntersectionObserver((entries) => {
      if (started || !entries.some((e) => e.isIntersecting)) return;
      started = true;
      io.disconnect();
      setValue(from);
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        setValue(Math.round(from + (to - from) * quint(p)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, from, duration]);

  return (
    <span ref={ref} className="nn" style={{ display: "inline-grid", fontVariantNumeric: "tabular-nums" }}>
      <span className="sr-only">{to}</span>
      <span aria-hidden="true" style={{ gridArea: "1 / 1" }}>{value}</span>
      <span aria-hidden="true" style={{ gridArea: "1 / 1", visibility: "hidden" }}>{Math.max(to, from)}</span>
    </span>
  );
}
