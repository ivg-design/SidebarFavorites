import { readFileSync } from "fs";
import { join } from "path";
import { decodeEntities } from "@/content/docs/types";

export interface ChangelogSection { title: string; items: string[] }
export interface ChangelogEntry { version: string; date: string; intro: string; sections: ChangelogSection[] }

/** Parses CHANGELOG.md (Keep a Changelog, bullets hard-wrapped at 80 columns). */
export function parseChangelog(): ChangelogEntry[] {
  let content: string;
  try {
    content = readFileSync(join(process.cwd(), "content/CHANGELOG.md"), "utf-8");
  } catch {
    return [];
  }
  const entries: ChangelogEntry[] = [];
  let cur: ChangelogEntry | null = null;
  let section: ChangelogSection | null = null;
  let open = false; // last item can still be continued

  for (const line of content.split("\n")) {
    const v = line.match(/^## \[(.+?)\] - (Unreleased|\d{4}-\d{2}-\d{2})/);
    if (v) {
      if (cur) entries.push(cur);
      cur = { version: v[1], date: v[2], intro: "", sections: [] };
      section = null; open = false;
      continue;
    }
    if (!cur) continue;
    const s = line.match(/^### (.+?)\s*$/);
    if (s) { section = { title: s[1], items: [] }; cur.sections.push(section); open = false; continue; }
    if (!line.trim()) { open = false; continue; }

    if (!section) { cur.intro = `${cur.intro} ${line.trim()}`.trim(); continue; }
    if (/^- /.test(line)) { section.items.push(line.slice(2).trim()); open = true; continue; }
    if (/^\s+- /.test(line) && section.items.length) {
      section.items[section.items.length - 1] += ` • ${line.replace(/^\s+- /, "").trim()}`;
      open = true; continue;
    }
    if (/^\s+\S/.test(line) && open && section.items.length) {
      section.items[section.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    section.items.push(line.trim()); // a paragraph inside a section
    open = true;
  }
  if (cur) entries.push(cur);
  return entries.map((e) => ({
    ...e,
    intro: decodeEntities(e.intro),
    sections: e.sections.map((x) => ({ title: decodeEntities(x.title), items: x.items.map(decodeEntities) })),
  }));
}
