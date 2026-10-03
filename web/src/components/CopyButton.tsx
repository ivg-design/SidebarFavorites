"use client";
// OWNER: worker D. Copies `text`; icon flips copy -> check and a "Copied" pop shows for 1.2 s.
// `variant="chip"` (hero brew chip, shows the text) or `variant="box"` (small button in the brew box).
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function CopyButton({
  text,
  variant = "chip",
  label,
  ariaLabel = "Copy install command",
}: {
  text: string;
  variant?: "chip" | "box";
  label?: string;
  ariaLabel?: string;
}) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onClick = useCallback(async () => {
    const ok = await copyText(text);
    if (!ok) return;
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), 1200);
  }, [text]);

  const button = (
    <button type="button" className={variant === "chip" ? "brew-chip" : "cp"} onClick={onClick} aria-label={ariaLabel}>
      <span>{label ?? text}</span>
      <span className="swap" data-on={on} aria-hidden="true">
        <Copy className="a" size={16} />
        <Check className="b" size={16} />
      </span>
    </button>
  );
  const pop = (
    <>
      <span className="copied-pop" data-on={on} aria-hidden="true">Copied</span>
      <span className="sr-only" role="status" aria-live="polite">{on ? "Copied to clipboard" : ""}</span>
    </>
  );

  if (variant === "box") return <>{button}{pop}</>;
  return (
    <span style={{ position: "relative", display: "inline-flex", maxWidth: "100%" }}>
      {button}
      {pop}
    </span>
  );
}
