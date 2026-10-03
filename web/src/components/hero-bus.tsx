"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface PreviewRow { name: string; glyph: string }
interface Bus {
  /** Row hovered in the After column; the hero's selected row previews it. */
  preview: PreviewRow | null;
  setPreview: (p: PreviewRow | null) => void;
  /** Increments each time the nav icon has been clicked five times in a row. */
  eggTick: number;
  fireEgg: () => void;
}
const Ctx = createContext<Bus>({ preview: null, setPreview: () => {}, eggTick: 0, fireEgg: () => {} });
export const useHeroBus = () => useContext(Ctx);

export function HeroBusProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<PreviewRow | null>(null);
  const [eggTick, setEgg] = useState(0);
  const fireEgg = useCallback(() => setEgg((n) => n + 1), []);
  const value = useMemo(() => ({ preview, setPreview, eggTick, fireEgg }), [preview, eggTick, fireEgg]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
