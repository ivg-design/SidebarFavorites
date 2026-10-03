"use client";
import { BookOpen, Copy, Cpu, Download, Github, Globe, History, MousePointerClick, Shapes, type LucideIcon } from "lucide-react";
import { FolderGlyph } from "@/components/finder/Finder";
import { asset, REPO_URL } from "@/lib/config";
import { nb } from "@/lib/nowrap";
import { markVisited, SECTIONS, useSectionProgress, type SectionId } from "./useSectionProgress";
import "@/app/rail.css";

const SECTION_GLYPH: Record<SectionId, LucideIcon> = {
  how: MousePointerClick, custom: Shapes, everywhere: Globe, both: Copy, hood: Cpu, install: Download,
};

function Row({ href, label, Icon, state, current, external, testid, onNavigate }: {
  href: string; label: string; Icon: LucideIcon; state: "folder" | "visited" | "static"; current?: boolean;
  external?: boolean; testid: string; onNavigate?: () => void;
}) {
  return (
    <a
      className="rail-row" href={href} data-testid={testid} data-state={state}
      aria-current={current ? "true" : undefined} onClick={onNavigate}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className="rail-ic" aria-hidden="true">
        {state !== "static" && <FolderGlyph className="rail-folder" />}
        <Icon className="rail-glyph" size={16} strokeWidth={1.6} />
      </span>
      <span className="rail-lab">{nb(label)}</span>
      {external && <span className="rail-ext" aria-hidden="true">↗</span>}
    </a>
  );
}

/** The Finder-sidebar list shared by the desktop rail and the mobile menu panel. */
export default function RailList({ idPrefix, onNavigate }: { idPrefix: string; onNavigate?: () => void }) {
  const { visited, current } = useSectionProgress();
  return (
    <>
      <div className="rail-h" id={`${idPrefix}-fav`}>Favorites</div>
      <ul className="rail-ul" aria-labelledby={`${idPrefix}-fav`}>
        {SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <Row
              href={`#${id}`} label={label} Icon={SECTION_GLYPH[id]} testid={`${idPrefix}-row-${id}`}
              state={visited[id] ? "visited" : "folder"} current={current === id}
              onNavigate={() => { markVisited(id); onNavigate?.(); }}
            />
          </li>
        ))}
      </ul>
      <div className="rail-h" id={`${idPrefix}-loc`}>Locations</div>
      <ul className="rail-ul" aria-labelledby={`${idPrefix}-loc`}>
        <li><Row href={asset("/docs")} label="Docs" Icon={BookOpen} state="static" testid={`${idPrefix}-row-docs`} onNavigate={onNavigate} /></li>
        <li><Row href={asset("/changelog")} label="Changelog" Icon={History} state="static" testid={`${idPrefix}-row-changelog`} onNavigate={onNavigate} /></li>
        <li><Row href={REPO_URL} label="GitHub" Icon={Github} state="static" external testid={`${idPrefix}-row-github`} onNavigate={onNavigate} /></li>
      </ul>
    </>
  );
}
