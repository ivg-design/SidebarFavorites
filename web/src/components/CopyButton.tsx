"use client";
// Copies `text` (clipboard API, textarea fallback). The copied state lasts 1.6 s and is announced politely.
// variant "chip": a mono chip showing the text (hero); the confirmation covers the chip, nothing floats.
// variant "box": a small ghost button with a label; the label and icon swap copy -> Copied in place.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

const COPIED_MS = 1600;

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
    timer.current = setTimeout(() => setOn(false), COPIED_MS);
  }, [text]);

  const status = <span className="sr-only" role="status" aria-live="polite">{on ? "Copied to clipboard" : ""}</span>;
  const swap = (
    <span className="swap" aria-hidden="true">
      <Copy className="a" size={16} />
      <Check className="b" size={16} />
    </span>
  );

  if (variant === "box") {
    const t = (show: boolean) => ({ opacity: show ? 1 : 0, transition: "opacity var(--t-base) var(--ease-quart)" });
    return (
      <>
        <button type="button" className="btn btn-ghost btn-sm" data-testid="copy-box" data-on={on} onClick={onClick} aria-label={ariaLabel}>
          <span aria-hidden="true" style={{ display: "inline-grid" }}>
            <span style={{ gridArea: "1 / 1", ...t(!on) }}>{label ?? "Copy"}</span>
            <span style={{ gridArea: "1 / 1", ...t(on) }}>Copied</span>
          </span>
          <span className="swap" aria-hidden="true" style={{ position: "relative", width: 16, height: 16, flex: "none" }}>
            <Copy size={16} style={{ position: "absolute", inset: 0, ...t(!on) }} />
            <Check size={16} style={{ position: "absolute", inset: 0, ...t(on) }} />
          </span>
        </button>
        {status}
      </>
    );
  }
  return (
    <>
      <button type="button" className="chip" data-testid="copy-chip" data-on={on} onClick={onClick} aria-label={`${ariaLabel ?? "Copy"}: ${label ?? text}`}>
        <span>{label ?? text}</span>
        {swap}
        <span className="copied-in" data-on={on} aria-hidden="true"><Check size={16} />Copied</span>
      </button>
      {status}
    </>
  );
}
