"use client";
import { useEffect } from "react";

const BREAK = /[/._\-:=?&,]/;

/** Inserts <wbr> after "/ . _ - : = ? & ," in inline code so phones break paths at sensible points. */
export default function SoftBreaks({ root }: { root: string | string[] }) {
  const key = Array.isArray(root) ? root.join(",") : root;
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(key).forEach((scope) => {
      scope.querySelectorAll<HTMLElement>("code").forEach((code) => {
        if (code.closest(".dx-code") || code.dataset.soft === "true" || code.classList.contains("dx-tk")) return;
        const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
        for (const node of nodes) {
          const text = node.data;
          if (!BREAK.test(text)) continue;
          const frag = document.createDocumentFragment();
          text.split(/(?<=[/._\-:=?&,])/).forEach((part, i) => {
            if (i) frag.appendChild(document.createElement("wbr"));
            frag.appendChild(document.createTextNode(part));
          });
          node.replaceWith(frag);
        }
        code.dataset.soft = "true";
      });
    });
  }, [key]);
  return null;
}
