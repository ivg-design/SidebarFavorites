import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SHOTS, SHOT_SCALE } from "@/lib/shots";

/** One servable image of a capture. */
export interface DocShotFile { src: string; src2x?: string; w: number; h: number; shows?: string; framed: boolean }
interface ManifestEntry { file: string; file2x?: string; width?: number; height?: number; appearance?: string; title?: string; shows?: string; section?: string }

/** Where framed captures live, newest set first. Each folder has its own manifest.json. */
const DIRS = ["shots-app", "shots"];

let cache: Map<string, ManifestEntry & { dir: string }> | null = null;
/** Every manifest entry keyed by file stem. A manifest is an array or { images | shots: [...] }. Empty when absent. */
function manifest(): Map<string, ManifestEntry & { dir: string }> {
  if (cache) return cache;
  const map = new Map<string, ManifestEntry & { dir: string }>();
  for (const dir of DIRS) {
    try {
      const raw = JSON.parse(readFileSync(join(process.cwd(), "public", dir, "manifest.json"), "utf8"));
      const list: ManifestEntry[] = Array.isArray(raw) ? raw : raw.images ?? raw.shots ?? Object.values(raw);
      for (const e of list) {
        if (!e || typeof e.file !== "string") continue;
        const stem = base(e.file).replace(/\.[a-z0-9]+$/i, "");
        if (!map.has(stem)) map.set(stem, { ...e, dir });
      }
    } catch { /* no manifest in this folder */ }
  }
  cache = map;
  return map;
}

const has = (dir: string, rel: string) => existsSync(join(process.cwd(), "public", dir, rel));
const base = (f: string) => f.replace(/^.*\//, "");

/** Width and height from the PNG itself: the file is the authority on its own size. */
function pngSize(dir: string, file: string): [number, number] | null {
  try {
    const buf = readFileSync(join(process.cwd(), "public", dir, file));
    if (buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG") return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  } catch { /* not readable */ }
  return null;
}

function fromManifest(stem: string): DocShotFile | null {
  const e = manifest().get(stem);
  if (!e || !has(e.dir, base(e.file))) return null;
  const size = pngSize(e.dir, base(e.file)) ?? (e.width && e.height ? [e.width, e.height] : null);
  if (!size) return null;
  const f2 = e.file2x && has(e.dir, base(e.file2x)) ? `/${e.dir}/${base(e.file2x)}` : undefined;
  return { src: `/${e.dir}/${base(e.file)}`, src2x: f2, w: size[0], h: size[1], shows: e.shows, framed: true };
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
  return { main: { src: `/shots/${name}-w${g.display}.webp`, src2x: `/shots/${name}-w${g.w}.webp`, w: g.display, h: Math.round(g.h * SHOT_SCALE), framed: true } };
}
