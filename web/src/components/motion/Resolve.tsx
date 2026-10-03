"use client";
import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";

/**
 * The page's one verb, "resolve": grey and soft -> colour and sharp, once, at ~35% in view.
 * SSR renders data-resolve="on" (end state, so a JS failure never leaves captures grey); on mount,
 * only elements below the fold flip to "off", then back to "on" via IntersectionObserver.
 * Reduced motion / no IntersectionObserver: stays "on". Filter only, so no layout shift.
 * `contents` makes the wrapper `display: contents` (it watches its first element child).
 */
export default function Resolve({ contents, children, style, ...rest }: ComponentPropsWithoutRef<"div"> & { contents?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const wrap = ref.current;
    if (!wrap || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = (contents ? wrap.firstElementChild : wrap) as HTMLElement | null;
    if (!target || target.getBoundingClientRect().top <= window.innerHeight) return;
    wrap.dataset.resolve = "off";
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        // a panel taller than the viewport can never reach 35% of itself: accept 35% of the viewport instead
        if (e.intersectionRatio >= 0.35 || e.intersectionRect.height >= window.innerHeight * 0.35) {
          wrap.dataset.resolve = "on"; io.disconnect(); return;
        }
      }
    }, { threshold: [0, 0.35] });
    io.observe(target);
    return () => { io.disconnect(); wrap.dataset.resolve = "on"; };
  }, [contents]);
  return <div ref={ref} data-resolve="on" style={contents ? { display: "contents", ...style } : style} {...rest}>{children}</div>;
}
