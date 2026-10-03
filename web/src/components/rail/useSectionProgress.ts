"use client";
import { useSyncExternalStore } from "react";

/** The page sections the rail and the header menu list, in page order. */
export const SECTIONS = [
  { id: "how", label: "How it works" },
  { id: "custom", label: "Custom icons" },
  { id: "everywhere", label: "Everywhere" },
  { id: "both", label: "Both icons" },
  { id: "hood", label: "Under the hood" },
  { id: "install", label: "Install" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export interface SectionProgress {
  /** Top of the section has crossed 45% of the viewport at least once this session. */
  visited: Readonly<Record<SectionId, boolean>>;
  /** Section whose range contains the 40% viewport line; null in the hero and between sections. */
  current: SectionId | null;
  /** The 40% line is inside the hero (#top). */
  inHero: boolean;
}

const VISIT_LINE = 0.45;
const CURRENT_LINE = 0.4;

const empty = Object.fromEntries(SECTIONS.map((s) => [s.id, false])) as Record<SectionId, boolean>;
const SERVER: SectionProgress = { visited: empty, current: null, inHero: false };

let state: SectionProgress = SERVER;
const listeners = new Set<() => void>();
let teardown: (() => void) | null = null;

function commit(next: SectionProgress) {
  const same =
    next.current === state.current &&
    next.inHero === state.inHero &&
    SECTIONS.every((s) => next.visited[s.id] === state.visited[s.id]);
  if (same) return;
  state = next;
  listeners.forEach((l) => l());
}

function measure() {
  const vh = window.innerHeight;
  const visited = { ...state.visited };
  let current: SectionId | null = null;
  for (const { id } of SECTIONS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.top <= vh * VISIT_LINE) visited[id] = true;
    if (r.top <= vh * CURRENT_LINE && r.bottom > vh * CURRENT_LINE) current = id;
  }
  const hero = document.getElementById("top")?.getBoundingClientRect();
  const inHero = !!hero && hero.top <= vh * CURRENT_LINE && hero.bottom > vh * CURRENT_LINE;
  commit({ visited, current, inHero });
}

/** Mark a section visited without waiting for the scroll (rail navigation). */
export function markVisited(id: SectionId) {
  if (state.visited[id]) return;
  commit({ ...state, visited: { ...state.visited, [id]: true } });
}

function start() {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; measure(); });
  };
  const io = new IntersectionObserver(schedule, { rootMargin: "0px 0px -55% 0px", threshold: [0, 1] });
  [...SECTIONS.map((s) => s.id), "top"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  schedule();
  return () => {
    io.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!teardown) teardown = start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && teardown) { teardown(); teardown = null; }
  };
}

export function useSectionProgress(): SectionProgress {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
