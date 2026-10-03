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

export function docUrl(slug: string): string {
  return slug === "quick-start" ? "/docs" : `/docs/${slug}`;
}
