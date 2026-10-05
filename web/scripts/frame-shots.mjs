// Frames raw window captures (scripts/docs-screenshots.sh -> SBF_SCREENSHOTS) on a soft gradient with a drop
// shadow and an even margin, and writes <name>.png (1x) + <name>@2x.png + manifest.json.
//
//   node scripts/frame-shots.mjs <rawDir> [--out public/shots-app]
//
// Raw captures are 2x window pixels with SQUARE corners (the window server rounds them on screen), so each
// <name>.json sidecar carries the corner radius (pt) and appearance; the compositor rounds the corners itself.
// The window is the subject: margin = ~7% of the window width on every side (about 6% of the final image).
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

// SidebarFavorites' wallpaper arc: warm peach, magenta (the site accent #D2358A), violet, a little blue.
const GRADIENTS = {
  dusk:    { angle: 145, stops: ["#F7B98A", "#E8639A", "#8B5BDC"] },
  rose:    { angle: 150, stops: ["#FFD2BF", "#F28BB4", "#C257C4"] },
  violet:  { angle: 140, stops: ["#B9A2F4", "#7260E6", "#3F82E8"] },
  ember:   { angle: 155, stops: ["#FFCB8E", "#F5806C", "#CC3A92"] },
  orchid:  { angle: 135, stops: ["#F0A6D8", "#B05BD9", "#5C63E8"] },
  night:   { angle: 145, stops: ["#6A4BC4", "#B02A74", "#E4784F"] },
  midnight:{ angle: 140, stops: ["#2C3A8C", "#6B3FC4", "#C23C8E"] },
};

// name -> [gradient, title, shows, section]
const SHOTS = {
  "main-window": ["dusk", "The manager window", "The SidebarFavorites manager window listing seven sample folders (Projects, Clients, Invoices, Screenshots, Brand Assets, Music, Archive), each with its sidebar glyph, folder path, In Sidebar or Disabled status and an on/off switch; a plus button at the top right adds a favorite and Refresh sits in the footer beside the version.", "main"],
  "main-window-dark": ["night", "The manager window, dark", "The manager window in dark appearance with the same seven folders, glyphs, status labels and switches.", "main"],
  "main-window-empty": ["rose", "The manager window with no favorites", "The empty manager window: a sidebar symbol, the heading No Favorites, a line saying folders can be added to Finder's sidebar with custom icons, and an Add Favorite button.", "main"],
  "main-window-notices": ["ember", "Warning and Finder restart notices", "The manager window with a collapsed 1 Warning banner and an orange banner saying some icon changes need Finder to restart, with a Restart Finder button.", "main"],
  "editor-add": ["violet", "Add Favorite", "The Add Favorite window on a blank form: Name, a Folder Path field with Browse, the Sidebar icon only / Both icons switch, the SF Symbol / Custom SVG switch, the symbol name field with Browse All, the grid of 24 quick-pick symbols, and a Preview, with Cancel, Apply and Add at the bottom.", "editor"],
  "editor-icon-before": ["rose", "Assigning an icon: before", "The Edit Favorite window for the folder Projects while it still has the plain folder.fill symbol: the quick-pick grid with the folder selected, and the Preview showing the default folder glyph.", "editor"],
  "editor-icon-after": ["rose", "Assigning an icon: after", "The same Edit Favorite window after picking the hammer symbol: hammer.fill in the Symbol Name field, the hammer highlighted in the quick-pick grid, and the Preview showing the hammer.", "editor"],
  "editor-icon-after-dark": ["midnight", "Assigning an icon, dark", "The Edit Favorite window in dark appearance with hammer.fill chosen: Symbol Name field, highlighted quick pick, Preview.", "editor"],
  "editor-both-icons": ["orchid", "Both icons mode", "The editor with Both icons selected: an explanation that the folder keeps its own icon while the sidebar shows your glyph, and the note that a helper named SBF-Music is added to System Settings (about 6 MB).", "editor"],
  "editor-own-icon": ["ember", "A folder with an icon of its own", "The editor for a folder that carries a custom icon: an orange notice that the folder has a custom icon of its own, why that makes the sidebar icon vanish, and three choices (Keep both icons, Remove its icon, Leave as is).", "editor"],
  "editor-custom-svg": ["violet", "Custom SVG with size and preview", "The editor in Custom SVG mode: the chosen file brand-mark.svg with Replace, the Size slider at 100 percent with Reset, the enlarged preview, a sidebar-size preview row, and the warning that colours and gradients flatten into one silhouette.", "editor"],
  "symbol-browser": ["dusk", "The SF Symbols browser", "The SF Symbols sheet: a search field, a grid of symbols with the current one (hammer.fill) selected, the symbol name at the bottom left, and Cancel and Use Symbol buttons.", "picker"],
  "symbol-browser-search": ["orchid", "Searching the symbol catalog", "The SF Symbols sheet searched for folder: the matching folder symbols in a grid, folder.fill selected, with Cancel and Use Symbol.", "picker"],
  "symbol-browser-dark": ["midnight", "The SF Symbols browser, dark", "The SF Symbols sheet in dark appearance searched for music, with music.note selected.", "picker"],
  "settings": ["violet", "Settings", "The Settings window: Launch at Login and Show in Menu Bar switches, the About block with version and the helper app location, and the Actions section with Restart Finder and Remove All Sidebar Icons.", "settings"],
  "settings-helpers": ["ember", "Settings with a Finder Sync helper", "The Settings window with a Finder Sync Helpers section listing the helper for a Both-icons favorite, its registration status, and the Open Extensions Settings and Refresh Status buttons.", "settings"],
  "migration-consent": ["dusk", "Upgrade to 1.0 consent", "The upgrade sheet that asks before doing anything: what will be removed (old helper apps), what will change (settings file format, icon codes) and what will be kept, with Not Now and Upgrade buttons.", "onboarding"],
  "menu-bar-menu": ["rose", "The menu bar menu", "The menu bar menu content: each favorite with its glyph, then Open SidebarFavorites, Refresh All, Preferences, the version line and Quit. Rendered from the menu's own items (a native menu cannot be captured offscreen).", "menubar"],
  "alert-update": ["violet", "Update available", "The alert saying a new version is available, with Later and Download buttons.", "alerts"],
  "alert-remove-favorite": ["rose", "Remove a favorite", "The confirmation asking Remove Projects, explaining the row is removed from Finder's sidebar and the folder's normal icon returns, with Cancel and Remove.", "alerts"],
  "alert-turn-off": ["ember", "Turn off a favorite", "The confirmation for turning off a favorite the app added, explaining the row is removed and re-added at the bottom if turned back on, with Turn Off and Remove Row and Cancel.", "alerts"],
  "alert-remove-all": ["orchid", "Remove all sidebar icons", "The confirmation listing exactly what Remove All Sidebar Icons will do (rows removed, icons cleared, helper bundle deleted, cannot be undone), with Remove All Sidebar Icons and Cancel.", "alerts"],
};

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const rawDir = resolve(args[0] ?? ".");
const outDir = resolve(flag("--out", "public/shots-app"));
mkdirSync(outDir, { recursive: true });

function gradientSvg(w, h, { angle, stops }) {
  const a = ((angle - 90) * Math.PI) / 180;
  const cx = w / 2, cy = h / 2, len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const x1 = cx - (Math.cos(a) * len) / 2, y1 = cy - (Math.sin(a) * len) / 2;
  const x2 = cx + (Math.cos(a) * len) / 2, y2 = cy + (Math.sin(a) * len) / 2;
  const s = stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)) * 100}%" stop-color="${c}"/>`).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);
}

/** Round the window's corners (radius in 2x px) and make them transparent. */
async function rounded(buf, radius) {
  const { width, height } = await sharp(buf).metadata();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
  return sharp(buf).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function shadow(win, ww, wh, pad, blur, opacity, radius) {
  const rect = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ww + pad * 2}" height="${wh + pad * 2}"><rect x="${pad}" y="${pad}" width="${ww}" height="${wh}" rx="${radius}" fill="rgba(20,10,40,${opacity})"/></svg>`);
  return sharp(rect).blur(blur).png().toBuffer();
}

const manifest = [];
for (const f of readdirSync(rawDir).filter((f) => extname(f) === ".png").sort()) {
  const name = basename(f, ".png");
  const meta = existsSync(join(rawDir, `${name}.json`)) ? JSON.parse(readFileSync(join(rawDir, `${name}.json`), "utf8")) : { radius: 16, appearance: "light" };
  const info = SHOTS[name] ?? ["dusk", name, "", "other"];
  const radius2 = meta.radius * 2;
  const win = await rounded(readFileSync(join(rawDir, f)), radius2);
  const { width: ww, height: wh } = await sharp(win).metadata();
  const m = Math.round(ww * 0.0815);            // even margin all round = 7% of window width per side
  const W = ww + m * 2, H = wh + m * 2;
  const pad = 70;
  const sh1 = await shadow(win, ww, wh, pad, 26, 0.34, radius2);
  const sh2 = await shadow(win, ww, wh, pad, 5, 0.26, radius2);
  // shadows on a padded transparent canvas (they may extend past a small margin), cropped to the image
  const shadows = await sharp({ create: { width: W + pad * 2, height: H + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: sh1, left: m, top: m + 18 }, { input: sh2, left: m, top: m + 5 }]).png().toBuffer()
    .then((b) => sharp(b).extract({ left: pad, top: pad, width: W, height: H }).png().toBuffer());
  const buf = await sharp(gradientSvg(W, H, GRADIENTS[info[0]]))
    .composite([{ input: shadows, left: 0, top: 0 }, { input: win, left: m, top: m }]).png().toBuffer();
  await sharp(buf).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(join(outDir, `${name}@2x.png`));
  const w1 = Math.round(W / 2), h1 = Math.round(H / 2);
  await sharp(buf).resize(w1, h1, { kernel: "lanczos3" }).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(join(outDir, `${name}.png`));
  manifest.push({ file: `${name}.png`, file2x: `${name}@2x.png`, width: w1, height: h1, width2x: W, height2x: H,
    appearance: meta.appearance, title: info[1], shows: info[2], section: info[3], capture: meta.method });
  console.log(`${name}: ${W}x${H} @2x, ${w1}x${h1} @1x`);
}
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
