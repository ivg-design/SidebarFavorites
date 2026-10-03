"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export const EASE_QUART = [0.25, 1, 0.5, 1] as const;
export const EASE_QUINT = [0.22, 1, 0.36, 1] as const;

/** Rise 12px + fade once when ~30% in view. Reduced motion renders the final state. */
export function Reveal({ children, delay = 0, y = 12, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" | "p" }) {
  const reduce = useReducedMotion();
  const M = motion[as];
  if (reduce) return <M className={className}>{children}</M>;
  return (
    <M className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6, delay, ease: EASE_QUART }}>
      {children}
    </M>
  );
}
