"use client";
// OWNER: worker D. Copies `text`; icon flips copy -> check and a "Copied" pop shows for 1.2 s.
// Use `variant="chip"` (hero brew chip, shows the text) or `variant="box"` (small button in the brew box).
import { Copy } from "lucide-react";
export default function CopyButton({ text, variant = "chip", label }: { text: string; variant?: "chip" | "box"; label?: string }) {
  return <button type="button" className={variant === "chip" ? "brew-chip" : "cp"} onClick={() => navigator.clipboard?.writeText(text)}><span>{label ?? text}</span><Copy size={16} /></button>;
}
