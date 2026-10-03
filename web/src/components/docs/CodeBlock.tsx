"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Graphite code block. `code` is the raw text (what Copy puts on the clipboard).
 * With `prompt`, every line shows a non-selectable "$ " prefix.
 */
export default function CodeBlock({ code, prompt = false, label }: { code: string; prompt?: boolean; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const lines = code.replace(/\n$/, "").split("\n");

  const copy = async () => {
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { return; }
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="dx-code" data-prompt={prompt}>
      <button type="button" className="dx-copy" onClick={copy} aria-label={copied ? "Copied" : "Copy code"}>
        <span className="dx-swap" data-on={copied}>
          <Copy size={15} className="a" aria-hidden="true" />
          <Check size={15} className="b" aria-hidden="true" />
        </span>
        <span className="dx-copy-text" data-on={copied} aria-hidden="true">Copied</span>
      </button>
      <span className="sr-only" aria-live="polite">{copied ? "Copied to clipboard" : ""}</span>
      <pre tabIndex={0} aria-label={label ?? "Code"}><code>{lines.map((l, i) => <span key={i} className="dx-line">{l || " "}</span>)}</code></pre>
    </div>
  );
}
