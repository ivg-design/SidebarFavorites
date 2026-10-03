// Reads an SVG the way the app's SymbolValidator does: parse, note what a symbol cannot keep, and hand back a
// sanitised, normalised copy that is only ever used as a CSS mask image (alpha only). It is never injected as markup.
// Every sentence in WARN and ERR is copied verbatim from the app (SymbolValidator.swift). The two legibility checks
// (thin, dense, tiny at 16 pt) rasterise the artwork, which this page does not do, so they are left out, not faked.
const NS = "http://www.w3.org/2000/svg";
export const MAX_BYTES = 512 * 1024;

export type Analysis = { ok: true; svg: string; warnings: string[] } | { ok: false; error: string };

/** The app's errors, verbatim. `big` is this page's own limit, worded as the page's. */
export const MSG = {
  big: "This page reads files up to 512 KB.",
  notSvg: "This isn't an SVG file.",
  broken: "Couldn't read this SVG.",
  raster: "This SVG just wraps an image.",
  empty: "This SVG has no shapes we can use.",
  unusable: "We couldn't turn this SVG into a shape.",
} as const;

/** The app's warnings, verbatim. */
export const WARN = {
  raster: "The embedded image was dropped - a sidebar icon can't contain a photo or a PNG, only vector shapes.",
  text: "Live text isn't converted to shapes. If lettering is missing from the preview, outline it in your drawing app and import again.",
  dropped: (tags: string) => `Some parts of this SVG can't be reproduced in a symbol (${tags}). The preview shows what the icon will actually contain.`,
  colours: "Colours and gradients flatten into one silhouette, so lighter areas won't stay lighter.",
  wide: "Much wider than it is tall. Sidebar icons are square, so this gets shrunk to fit its width - a compact mark works better than a wordmark.",
  tall: "Much taller than it is wide. Sidebar icons are square, so this gets shrunk to fit its height - a compact mark reads better.",
} as const;

// What the page strips before using the file as a mask (safety, not the app's rules).
const DROP = new Set(["script", "foreignobject", "iframe", "object", "embed", "audio", "video", "canvas", "image", "text", "tspan", "textpath", "animate", "animatemotion", "animatetransform", "set"]);
const SHAPES = "path,rect,circle,ellipse,polygon,polyline,line,use";
const EXTERNAL_URL = /url\(\s*['"]?\s*(?!#)/i;

// The app's geometry parser (SVGGeometryParser): drawn tags, tags only drawn through <use> or describing paint,
// and tags it reports as not drawn.
const DRAWN = new Set(["svg", "g", "a", "switch", "use", "path", "rect", "circle", "ellipse", "line", "polygon", "polyline"]);
const DEFERRED = new Set(["defs", "symbol", "clippath", "mask", "marker", "pattern", "filter", "lineargradient", "radialgradient", "meshgradient", "style", "metadata", "title", "desc", "script", "foreignobject"]);
const REPORTED = new Set(["text", "textpath", "tspan", "clippath", "mask", "filter", "foreignobject", "script"]);
const OWN_WARNING = new Set(["image", "text", "tspan", "textpath"]);
// The app's colour scan.
const NON_COLOUR = new Set(["none", "transparent", "inherit", "currentcolor", "context-fill", "context-stroke"]);
const GRADIENTS = new Set(["lineargradient", "radialgradient", "meshgradient"]);

const lower = (el: Element) => el.localName.toLowerCase();

function styleProp(el: Element, name: string): string | null {
  const m = (el.getAttribute("style") ?? "").match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i"));
  return m ? m[1].trim() : null;
}

function num(v: string | null): number | null {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 && !/%/.test(v ?? "") ? n : null;
}

/** The app's scan pass: raster, live text, gradients and distinct paints, skipping template scaffolding. */
function scan(root: Element) {
  const out = { raster: false, text: false, gradient: false, paints: new Set<string>() };
  const addPaint = (raw: string) => {
    let v = raw.trim().toLowerCase();
    if (!v) return;
    if (v.startsWith("url(")) { out.gradient = true; return; }
    if (NON_COLOUR.has(v)) return;
    if (v === "black") v = "#000000";
    if (v === "white") v = "#ffffff";
    if (v.startsWith("#") && v.length === 4) v = "#" + [...v.slice(1)].map((c) => c + c).join("");
    out.paints.add(v);
  };
  const walk = (el: Element) => {
    const id = (el.getAttribute("id") ?? "").toLowerCase();
    const tag = lower(el);
    if (tag === "g" && (id === "guides" || id === "notes")) return;
    if (tag === "image") out.raster = true;
    else if ((tag === "text" || tag === "textpath") && id !== "template-version" && id !== "descriptive-name") out.text = true;
    else if (GRADIENTS.has(tag)) out.gradient = true;
    for (const k of ["fill", "stroke"]) { const v = el.getAttribute(k); if (v) addPaint(v); }
    for (const k of ["fill", "stroke"]) { const v = styleProp(el, k); if (v) addPaint(v); }
    for (const c of Array.from(el.children)) walk(c);
  };
  walk(root);
  return out;
}

/** Tags the app's geometry parser reports as not reproducible (sorted, lower case, minus those with their own warning). */
function droppedTags(root: Element): string[] {
  const dropped = new Set<string>();
  const ids = new Map<string, Element>();
  for (const e of Array.from(root.querySelectorAll("[id]"))) if (!ids.has(e.id)) ids.set(e.id, e);
  let work = 100_000;
  const render = (el: Element, depth: number) => {
    if (depth >= 64) return;
    const tag = lower(el);
    if (work-- <= 0) { if (tag) dropped.add(tag); return; }
    if (tag === "image") return;
    if (DEFERRED.has(tag) || REPORTED.has(tag)) { if (REPORTED.has(tag)) dropped.add(tag); return; }
    if (tag === "svg" || tag === "g" || tag === "a" || tag === "switch") { for (const c of Array.from(el.children)) render(c, depth + 1); return; }
    if (tag === "use") {
      const ref = el.getAttribute("href") ?? el.getAttribute("xlink:href");
      const target = ref && ref.startsWith("#") ? ids.get(ref.slice(1)) : undefined;
      if (!target || target === el) { dropped.add("use"); return; }
      const tt = lower(target);
      if (tt === "symbol" || tt === "defs") for (const c of Array.from(target.children)) render(c, depth + 1);
      else render(target, depth + 1);
      return;
    }
    if (!DRAWN.has(tag) && tag) dropped.add(tag);
  };
  render(root, 0);
  return [...dropped].filter((t) => !OWN_WARNING.has(t)).sort();
}

/** The artwork's bounds, measured by the browser on the sanitised copy (the app measures its path). */
function bounds(svg: string): { w: number; h: number } | null {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;visibility:hidden";
  host.innerHTML = svg;
  document.body.appendChild(host);
  try {
    const el = host.firstElementChild as unknown as SVGGraphicsElement | null;
    const b = el?.getBBox?.();
    return b && b.width > 0 && b.height > 0 ? { w: b.width, h: b.height } : null;
  } catch { return null; } finally { host.remove(); }
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
  const found = scan(root);
  const dropped = droppedTags(root);
  const vb = root.getAttribute("viewBox");
  const w = num(root.getAttribute("width")), h = num(root.getAttribute("height"));

  // Sanitise: remove what can run or fetch, and whatever a symbol drops anyway.
  for (const e of Array.from(doc.querySelectorAll("*"))) {
    if (!e.isConnected) continue;
    if (DROP.has(lower(e))) { e.remove(); continue; }
    if (lower(e) === "style" && /@import|url\(/i.test(e.textContent ?? "") && EXTERNAL_URL.test(e.textContent ?? "")) { e.remove(); continue; }
    for (const a of Array.from(e.attributes)) {
      const n = a.name.toLowerCase(), v = a.value;
      if (n.startsWith("on") || /javascript:/i.test(v) || EXTERNAL_URL.test(v) || (n === "href" || n.endsWith(":href")) && !v.trim().startsWith("#")) e.removeAttribute(a.name);
    }
  }
  if (!doc.querySelector(SHAPES)) return { ok: false, error: found.raster ? MSG.raster : MSG.empty };

  // Normalise the frame so the mask has an intrinsic size and aspect.
  const parts = vb ? vb.trim().split(/[\s,]+/).map(Number) : [];
  const box = parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0 ? parts : [0, 0, w ?? 100, h ?? w ?? 100];
  root.setAttribute("viewBox", box.join(" "));
  root.setAttribute("width", String(box[2]));
  root.setAttribute("height", String(box[3]));
  const svg = new XMLSerializer().serializeToString(root);

  // Same order as the app: image, text, dropped parts, colours, aspect.
  const warnings: string[] = [];
  if (found.raster) warnings.push(WARN.raster);
  if (found.text) warnings.push(WARN.text);
  if (dropped.length) warnings.push(WARN.dropped(dropped.map((t) => `<${t}>`).join(", ")));
  if (found.gradient || found.paints.size > 1) warnings.push(WARN.colours);
  const b = bounds(svg);
  if (b && Math.max(b.w / b.h, b.h / b.w) > 3) warnings.push(b.w > b.h ? WARN.wide : WARN.tall);
  return { ok: true, svg, warnings };
}

/** The CSS value of a mask-image for a (sanitised) SVG string. */
export function maskUrl(svg: string): string {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
