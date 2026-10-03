"use client";
// Per-character 3D flip (the lerp word-spinner mechanism): old characters rotate out (0 -> 90deg),
// new ones rotate in (-90 -> 0) at the same time, 0..300 ms stagger across the word.
import { useEffect, useRef, useState, type ElementType } from "react";
import { useInView } from "framer-motion";
import "./flip.css";

const OUT_MS = 500 + 300 + 60;

/** Characters grouped by word so a long phrase wraps between words only. */
function Chars({ text, stagger }: { text: string; stagger: (i: number, n: number) => number }) {
  const words = text.split(" ");
  let i = 0;
  return (
    <>
      {words.map((w, wi) => (
        <span key={wi}>
          {wi > 0 && " "}
          <span className="flip-w">
            {[...w].map((c, ci) => (
              <span key={ci} className="flip-char" style={{ ["--flip-d" as string]: `${stagger(i++, text.replace(/ /g, "").length)}ms` }}>{c}</span>
            ))}
          </span>
        </span>
      ))}
    </>
  );
}

const across = (delay = 0) => (i: number, n: number) => delay + Math.round((i / Math.max(n - 1, 1)) * 300);

/** Flips from the previous text to `text` whenever `text` changes. `delayIn` (ms) flips the first text in on mount. */
export function Flip({ text, as = "span", className, delayIn, ...rest }: { text: string; as?: ElementType; className?: string; delayIn?: number; "data-testid"?: string }) {
  const El = as;
  const [shown, setShown] = useState(text);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [gen, setGen] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (text === shown) return;
    if (timer.current) clearTimeout(timer.current);
    // Swapping the displayed text is the whole point of this effect: it starts the flip.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLeaving(shown);
    setShown(text);
    setGen((g) => g + 1);
    /* eslint-enable react-hooks/set-state-in-effect */
    timer.current = setTimeout(() => setLeaving(null), OUT_MS);
  }, [text, shown]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const first = gen === 0;
  return (
    <El className={`flip ${className ?? ""}`} role="img" aria-label={text} {...rest}>
      {leaving !== null && <span className="flip-layer flip-out" key={`o${gen}`} aria-hidden="true"><Chars text={leaving} stagger={across()} /></span>}
      <span className={`flip-layer ${first && !delayIn ? "flip-still" : "flip-in"}`} key={`i${gen}`} aria-hidden="true"><Chars text={shown} stagger={across(first ? delayIn : 0)} /></span>
    </El>
  );
}

/** One-shot entrance: characters flip in from blank when scrolled into view. `perChar` ms apart. */
export function FlipIn({ text, as = "span", className, delayStart = 0, perChar = 40, ...rest }: { text: string; as?: ElementType; className?: string; delayStart?: number; perChar?: number; "data-testid"?: string }) {
  const El = as;
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    // Armed only on the client and only when motion is allowed, so SSR and reduced motion show the final text.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArmed(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  const mode = !armed ? "flip-still" : seen ? "flip-in" : "flip-pre";
  return (
    <El ref={ref} className={`flip ${className ?? ""}`} role="img" aria-label={text} {...rest}>
      <span className={`flip-layer ${mode}`} aria-hidden="true"><Chars text={text} stagger={(i) => delayStart + i * perChar} /></span>
    </El>
  );
}
