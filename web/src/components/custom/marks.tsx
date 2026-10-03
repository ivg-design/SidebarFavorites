// Three sample marks, drawn inline (no files, transparent). `mono` renders what the app would ship:
// the same shapes with one fill (currentColor); gradients, colour and live text are dropped.
import type { ReactElement } from "react";

export type MarkId = "a" | "b" | "c";
export interface MarkDef { id: MarkId; name: string; kind: string; warnings: string[] }

const W_COLOUR = "Colours and gradients dropped (sidebar icons are monochrome)";
const W_HAIR = "Hairlines thickened or dropped: too fine to read at 16 pt";
const W_TEXT = "Live text was never outlined: dropped";

export const MARKS: MarkDef[] = [
  { id: "a", name: "Badge", kind: "Two-colour logo", warnings: [W_COLOUR] },
  { id: "b", name: "Gem", kind: "Line icon, gradient", warnings: [W_COLOUR, W_HAIR] },
  { id: "c", name: "Wordmark", kind: "Live text", warnings: [W_COLOUR, W_TEXT] },
];

/** One mark at `size` px. Drawn on a 48-unit grid so the hairlines are truly 1 px at 48. */
export function MarkSvg({ id, mono, size }: { id: MarkId; mono?: boolean; size: number }) {
  const c = (v: string) => (mono ? "currentColor" : v);
  let body: ReactElement;
  if (id === "a") {
    body = (
      <>
        <path fillRule="evenodd" fill={c("#2F6BFF")} d="M10 4h28a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6zM24 10a14 14 0 1 0 0 28a14 14 0 0 0 0-28z" />
        <path fill={c("#FFB020")} d="M26 15L17 26.5h5.5L21 33l9-11.5h-5.5z" />
      </>
    );
  } else if (id === "b") {
    body = (
      <>
        {!mono && (
          <defs>
            <linearGradient id="cx-grad-b" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#8B5CFF" /><stop offset="1" stopColor="#25D3C0" />
            </linearGradient>
          </defs>
        )}
        <path d="M24 8l13 7.5v15L24 38l-13-7.5v-15z" fill={mono ? "currentColor" : "url(#cx-grad-b)"} />
        {!mono && <path d="M24 8v30M11 15.5l26 15M37 15.5l-26 15" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1" />}
        <circle cx="24" cy="24" r="21" fill="none" stroke={c("#9CA3FF")} strokeWidth="1" />
        <path d="M24 3v5M24 38v5M5.8 13.5l4.2 2.5M38 32l4.2 2.5" fill="none" stroke={c("#9CA3FF")} strokeWidth="1" />
      </>
    );
  } else {
    body = (
      <>
        {!mono && (
          <text x="4" y="31" fontSize="27" fontWeight="800" fill="#F5F5F7" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="-1">Fg</text>
        )}
        <rect x="6" y="37" width="30" height="4" rx="2" fill={c("#FF7A2F")} />
        <circle cx="40" cy="12" r="4.5" fill={c("#FF7A2F")} />
      </>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" style={{ overflow: "visible" }}>
      {body}
    </svg>
  );
}
