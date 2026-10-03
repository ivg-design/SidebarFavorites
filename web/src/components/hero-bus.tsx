"use client";
import type { ReactNode } from "react";

/** Retired: the hero no longer previews hovered rows. Harmless no-ops until page.tsx drops the provider. */
export const useHeroBus = () => ({});
export function HeroBusProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
