// Reads an SVG the way the app does: parse, note what a symbol cannot keep, and hand back a sanitised,
// normalised copy that is only ever used as a CSS mask image (alpha only). It is never injected as markup.
const NS = "http://www.w3.org/2000/svg";
export const MAX_BYTES = 512 * 1024;

export type Analysis = { ok: true; svg: string; warnings: string[] } | { ok: false; error: string };

export const MSG = {
  big: "That file is over 512 KB. Try a lighter SVG.",
  notSvg: "That is not an SVG. Choose a .svg file.",
  broken: "That SVG could not be read. The file may be damaged.",
  empty: "That SVG has no shapes to draw. Text and images do not count.",
} as const;

const DROP = new Set(["script", "foreignobject", "iframe", "object", "embed", "audio", "video", "canvas", "image", "text", "tspan", "textpath", "animate", "animatemotion", "animatetransform", "set"]);
const SHAPES = "path,rect,circle,ellipse,polygon,polyline,line,use";
const NOT_COLOUR = new Set(["none", "currentcolor", "inherit", "transparent", "context-fill", "context-stroke", ""]);
const EXTERNAL_URL = /url\(\s*['"]?\s*(?!#)/i;

const lower = (el: Element) => el.localName.toLowerCase();

function styleProp(el: Element, name: string): string | null {
  const m = (el.getAttribute("style") ?? "").match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i"));
  return m ? m[1].trim() : null;
}
/** A presentation property, from the style attribute or the attribute, inherited from the ancestors. */
function resolve(el: Element | null, name: string): string | null {
  for (let e = el; e; e = e.parentElement) {
    const v = styleProp(e, name) ?? e.getAttribute(name);
    if (v && v !== "inherit") return v.trim().toLowerCase();
  }
  return null;
}
function colourKey(v: string): string {
  const s = v.trim().toLowerCase();
  const m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : s.replace(/\s+/g, "");
}

function num(v: string | null): number | null {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 && !/%/.test(v ?? "") ? n : null;
}

export function analyse(raw: string): Analysis {
  if (raw.length > MAX_BYTES) return { ok: false, error: MSG.big };
  if (!/<svg[\s>]/i.test(raw)) return { ok: false, error: MSG.notSvg };
  // Hand-written files often lack the namespace; the browser will not draw them as an image without it.
  const text = /<svg[^>]*\sxmlns\s*=/i.test(raw) ? raw : raw.replace(/<svg(?=[\s>])/i, `<svg xmlns="${NS}"`);
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || doc.querySelector("parsererror")) return { ok: false, error: MSG.broken };
  if (lower(root) !== "svg" || root.namespaceURI !== NS) return { ok: false, error: MSG.notSvg };

  // Detect on the file as written, before anything is removed.
  const all = Array.from(doc.querySelectorAll("*"));
  const names = new Set(all.map(lower));
  const warnings: string[] = [];
  if (["text", "tspan", "textpath"].some((n) => names.has(n))) warnings.push("Text was dropped — convert it to outlines first");
  if (names.has("image")) warnings.push("Embedded bitmaps are dropped");
  if (["lineargradient", "radialgradient", "meshgradient", "pattern", "filter"].some((n) => names.has(n)) || all.some((e) => e.hasAttribute("filter") || styleProp(e, "filter"))) {
    warnings.push("Gradients and filters are flattened to the outline");
  }
  const colours = new Set<string>();
  for (const e of all) {
    for (const p of ["fill", "stroke", "stop-color"]) {
      const v = styleProp(e, p) ?? e.getAttribute(p);
      if (v && !NOT_COLOUR.has(v.trim().toLowerCase()) && !/^url\(/i.test(v.trim())) colours.add(colourKey(v));
    }
  }
  if (colours.size > 1) warnings.push("Colours are flattened — a symbol is monochrome");
  const strokeOnly = Array.from(doc.querySelectorAll(SHAPES)).some((e) => {
    const stroke = resolve(e, "stroke");
    return stroke && stroke !== "none" && resolve(e, "fill") === "none";
  });
  if (strokeOnly) warnings.push("Strokes become part of the outline");
  const vb = root.getAttribute("viewBox");
  const w = num(root.getAttribute("width")), h = num(root.getAttribute("height"));
  if (!vb) warnings.push("No viewBox — the app uses the drawing's bounds");

  // Sanitise: remove what can run or fetch, and whatever a symbol drops anyway.
  for (const e of all) {
    if (!e.isConnected) continue;
    if (DROP.has(lower(e))) { e.remove(); continue; }
    if (lower(e) === "style" && /@import|url\(/i.test(e.textContent ?? "") && EXTERNAL_URL.test(e.textContent ?? "")) { e.remove(); continue; }
    for (const a of Array.from(e.attributes)) {
      const n = a.name.toLowerCase(), v = a.value;
      if (n.startsWith("on") || /javascript:/i.test(v) || EXTERNAL_URL.test(v) || (n === "href" || n.endsWith(":href")) && !v.trim().startsWith("#")) e.removeAttribute(a.name);
    }
  }
  if (!doc.querySelector(SHAPES)) return { ok: false, error: MSG.empty };

  // Normalise the frame so the mask has an intrinsic size and aspect.
  const parts = vb ? vb.trim().split(/[\s,]+/).map(Number) : [];
  const box = parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0 ? parts : [0, 0, w ?? 100, h ?? w ?? 100];
  root.setAttribute("viewBox", box.join(" "));
  root.setAttribute("width", String(box[2]));
  root.setAttribute("height", String(box[3]));
  return { ok: true, svg: new XMLSerializer().serializeToString(root), warnings };
}

/** The CSS value of a mask-image for a (sanitised) SVG string. */
export function maskUrl(svg: string): string {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
