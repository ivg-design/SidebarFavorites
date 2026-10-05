import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SHOTS, SHOT_SCALE } from "@/lib/shots";

/** One servable image of a capture. */
export interface DocShotFile { src: string; src2x?: string; w: number; h: number; shows?: string; framed: boolean }
interface ManifestEntry { file: string; file2x?: string; width?: number; height?: number; appearance?: string; title?: string; shows?: string; section?: string }

let cache: Map<string, ManifestEntry> | null = null;
/** public/shots/manifest.json keyed by file stem. Accepts an array or { images | shots: [...] }. Empty when absent. */
function manifest(): Map<string, ManifestEntry> {
  if (cache) return cache;
  const map = new Map<string, ManifestEntry>();
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "shots", "manifest.json"), "utf8"));
    const list: ManifestEntry[] = Array.isArray(raw) ? raw : raw.images ?? raw.shots ?? Object.values(raw);
    for (const e of list) if (e && typeof e.file === "string") map.set(e.file.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, ""), e);
  } catch { /* no manifest yet: the generated captures are used */ }
  cache = map;
  return map;
}

const has = (rel: string) => existsSync(join(process.cwd(), "public", "shots", rel));
const base = (f: string) => f.replace(/^.*\//, "");

function fromManifest(stem: string): DocShotFile | null {
  const e = manifest().get(stem);
  if (!e || !e.width || !e.height || !has(base(e.file))) return null;
  const f2 = e.file2x && has(base(e.file2x)) ? `/shots/${base(e.file2x)}` : undefined;
  return { src: `/shots/${base(e.file)}`, src2x: f2, w: e.width, h: e.height, shows: e.shows, framed: true };
}

/**
 * Resolves a capture by name: the manifest's framed image (and its dark twin, `name-dark`) when the fresh set
 * has one, else the generated 0.65x capture from src/lib/shots.ts. Null when neither exists.
 */
export function docShot(name: string): { main: DocShotFile; dark?: DocShotFile } | null {
  const stem = name.replace(/-(light|dark)$/, "");
  const light = fromManifest(name) ?? fromManifest(`${stem}-light`) ?? fromManifest(stem);
  const dark = fromManifest(`${stem}-dark`);
  if (light) return { main: light, dark: dark && dark.src !== light.src ? dark : undefined };
  if (dark) return { main: dark };
  const g = (SHOTS as Record<string, { w: number; h: number; display: number }>)[name];
  if (!g) return null;
  return { main: { src: `/shots/${name}-w${g.display}.webp`, src2x: `/shots/${name}-w${g.w}.webp`, w: g.display, h: Math.round(g.h * SHOT_SCALE), framed: false } };
}
