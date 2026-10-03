// Three sample marks. `svg` is the file a designer might hand over (colour, gradient, live text); it goes through
// the same analyse() as a dropped file, so the warnings are parsed, not written. MarkSvg draws the 28 px choice.
import type { ReactElement } from "react";

export type MarkId = "a" | "b" | "c";
export interface MarkDef { id: MarkId; name: string; kind: string; svg: string }

const X = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"';

export const MARKS: MarkDef[] = [
  {
    id: "a", name: "Badge", kind: "Two-colour logo",
    svg: `<svg ${X}><path fill-rule="evenodd" fill="#2F6BFF" d="M10 4h28a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6zM24 10a14 14 0 1 0 0 28a14 14 0 0 0 0-28z"/><path fill="#FFB020" d="M26 15L17 26.5h5.5L21 33l9-11.5h-5.5z"/></svg>`,
  },
  {
    id: "b", name: "Gem", kind: "Line icon, gradient",
    svg: `<svg ${X}><defs><linearGradient id="g" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8B5CFF"/><stop offset="1" stop-color="#25D3C0"/></linearGradient></defs><path d="M24 8l13 7.5v15L24 38l-13-7.5v-15z" fill="url(#g)"/><path d="M24 8v30M11 15.5l26 15M37 15.5l-26 15" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1"/><circle cx="24" cy="24" r="21" fill="none" stroke="#9CA3FF" stroke-width="1"/><path d="M24 3v5M24 38v5M5.8 13.5l4.2 2.5M38 32l4.2 2.5" fill="none" stroke="#9CA3FF" stroke-width="1"/></svg>`,
  },
  {
    id: "c", name: "Wordmark", kind: "Live text",
    svg: `<svg ${X}><text x="4" y="31" font-size="27" font-weight="800" fill="#222" font-family="Georgia, serif" letter-spacing="-1">Fg</text><rect x="6" y="37" width="30" height="4" rx="2" fill="#FF7A2F"/><circle cx="40" cy="12" r="4.5" fill="#FF7A2F"/></svg>`,
  },
];

/** The sample in colour, as the designer drew it. */
export function MarkSvg({ id, size }: { id: MarkId; size: number }) {
  let body: ReactElement;
  if (id === "a") {
    body = (
      <>
        <path fillRule="evenodd" fill="#2F6BFF" d="M10 4h28a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6zM24 10a14 14 0 1 0 0 28a14 14 0 0 0 0-28z" />
        <path fill="#FFB020" d="M26 15L17 26.5h5.5L21 33l9-11.5h-5.5z" />
      </>
    );
  } else if (id === "b") {
    body = (
      <>
        <defs>
          <linearGradient id="cx-grad-b" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8B5CFF" /><stop offset="1" stopColor="#25D3C0" />
          </linearGradient>
        </defs>
        <path d="M24 8l13 7.5v15L24 38l-13-7.5v-15z" fill="url(#cx-grad-b)" />
        <circle cx="24" cy="24" r="21" fill="none" stroke="#9CA3FF" strokeWidth="1.5" />
      </>
    );
  } else {
    body = (
      <>
        <text x="4" y="31" fontSize="27" fontWeight="800" fill="#222" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="-1">Fg</text>
        <rect x="6" y="37" width="30" height="4" rx="2" fill="#FF7A2F" />
        <circle cx="40" cy="12" r="4.5" fill="#FF7A2F" />
      </>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">{body}</svg>
  );
}
