import type { ComponentType } from "react";

export type DocGroup = "Getting started" | "Guides" | "Reference" | "Help";
export const DOC_GROUPS: DocGroup[] = ["Getting started", "Guides", "Reference", "Help"];

export interface DocSection { id: string; title: string }

/** Everything about a page except its body: serialisable, safe to hand to client components. */
export interface DocMeta {
  slug: string;
  title: string;
  /** Label in the sidebar rail when it differs from the title. */
  navTitle?: string;
  group: DocGroup;
  description: string;
  keywords: string[];
  /** One or two plain sentences of body text, searched by the command palette. */
  excerpt: string;
  sections: DocSection[];
}

export interface DocPage extends DocMeta { Body: ComponentType }

/** Serialisable entry for the client shell and the search palette. */
export type DocIndexEntry = DocMeta & { url: string };

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "\u2192", larr: "\u2190", mdash: "\u2014", ndash: "\u2013", rsquo: "\u2019", lsquo: "\u2018", ldquo: "\u201C", rdquo: "\u201D", hellip: "\u2026", middot: "\u00B7", rsaquo: "\u203A", laquo: "\u00AB", raquo: "\u00BB" };

/** Decode HTML entities (named and numeric) to plain text; repeats so double-encoded input settles. */
export function decodeEntities(s: string): string {
  let cur = s;
  for (let i = 0; i < 3; i++) {
    const next = cur.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
      }
      return NAMED[e.toLowerCase()] ?? m;
    });
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/** Registry text is stored and shown as plain text: strip entities once, at the source. */
export function plainMeta<T extends DocMeta>(m: T): T {
  return {
    ...m,
    title: decodeEntities(m.title),
    navTitle: m.navTitle && decodeEntities(m.navTitle),
    description: decodeEntities(m.description),
    excerpt: decodeEntities(m.excerpt),
    keywords: m.keywords.map(decodeEntities),
    sections: m.sections.map((s) => ({ ...s, title: decodeEntities(s.title) })),
  };
}

export function docUrl(slug: string): string {
  return slug === "quick-start" ? "/docs" : `/docs/${slug}`;
}
