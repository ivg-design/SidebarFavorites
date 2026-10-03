// Builds optimised webp variants of the real screenshots in ../design/assets
// (converted from docs/assets) plus the app icon sizes and the video poster.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const src = path.resolve(root, "../design/assets");
const out = path.join(root, "public/shots");
const imgOut = path.join(root, "public/images");
await fs.mkdir(out, { recursive: true });
await fs.mkdir(imgOut, { recursive: true });

const shots = {
  SBFMainWindow: [430, 860],
  SFSymbolBrowser: [560, 1119],
  SBFAddFavoriteWindow: [480, 960],
  "svg-import": [420, 840],
  "custom-svg-settings": [420, 840],
  SBFAddFavoriteWithExistingIcon: [504, 1008],
  SBFAddFavoriteAdvancedSuccess: [480, 960],
  SBFTaskbarPopOver: [292, 584],
  SBFSettings: [472, 944],
  SBFUpdateNotification: [440, 880],
  example: [618],
};

let count = 0;
for (const [name, widths] of Object.entries(shots)) {
  const file = path.join(src, `${name}.png`);
  const meta = await sharp(file).metadata();
  const info = {};
  for (const w of widths) {
    const target = Math.min(w, meta.width);
    await sharp(file).resize({ width: target }).webp({ quality: 82, smartSubsample: true }).toFile(path.join(out, `${name}-w${w}.webp`));
    count++;
  }
  info.w = meta.width; info.h = meta.height;
}

// App icon
const icon = path.join(src, "sidebarfavorites-icon.png");
for (const s of [32, 64, 180, 512]) {
  await sharp(icon).resize(s, s).png({ compressionLevel: 9 }).toFile(path.join(imgOut, `icon-${s}.png`));
  count++;
}

// Video poster: the site's vivid wallpaper gradient with two real windows lifted onto it.
const W = 1600, H = 900;
const radial = (id, cx, cy, rx, ry, color) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="1" gradientTransform="translate(${cx} ${cy}) scale(${rx} ${ry}) translate(${-cx} ${-cy})"><stop offset="0" stop-color="${color}"/><stop offset=".6" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
<linearGradient id="base" x1=".29" y1=".03" x2=".71" y2=".97"><stop offset="0" stop-color="#2A4BD8"/><stop offset=".38" stop-color="#8A35C6"/><stop offset=".62" stop-color="#E24C7A"/><stop offset="1" stop-color="#F79A3E"/></linearGradient>
${radial("a", 0, 1, 1, 0.8, "#F2683D")}${radial("b", 0.95, 1, 1, 0.9, "#FFB13F")}${radial("c", 0.5, 0.55, 1.1, 0.9, "#D6407F")}${radial("d", 1, 0.1, 0.9, 0.8, "#6A33D9")}${radial("e", 0.08, 0, 1.2, 0.9, "#1E4FE0")}
</defs><rect width="100%" height="100%" fill="url(#base)"/>
${["a", "b", "c", "d", "e"].map((k) => `<rect width="100%" height="100%" fill="url(#${k})"/>`).join("")}</svg>`);

/** Window screenshot with rounded corners and a soft drop shadow, as PNG layers ready to composite. */
async function lifted(file, height, radius) {
  const body = await sharp(path.join(src, file)).resize({ height }).toBuffer();
  const { width, height: h } = await sharp(body).metadata();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}"><rect width="${width}" height="${h}" rx="${radius}" fill="#fff"/></svg>`);
  const win = await sharp(body).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const alpha = await sharp(win).extractChannel(3).linear(0.6, 0).toBuffer();
  const pad = 90;
  const shadow = await sharp({ create: { width: width + pad * 2, height: h + pad * 2, channels: 3, background: "#000" } })
    .joinChannel(await sharp(alpha).extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#000000" }).toBuffer())
    .blur(28).png().toBuffer();
  return { win, shadow, width, height: h, pad };
}

const main = await lifted("SBFMainWindow.png", Math.round(H * 0.56), 16);
const pop = await lifted("SBFTaskbarPopOver.png", 300, 14);
const place = (l, x, y, dy = 26) => [
  { input: l.shadow, left: x - l.pad, top: y - l.pad + dy },
  { input: l.win, left: x, top: y },
];
await sharp(bg)
  .composite([
    ...place(main, 150, Math.round((H - main.height) / 2)),
    ...place(pop, W - pop.width - 130, Math.round(H * 0.5 - pop.height / 2) + 40),
  ])
  .webp({ quality: 82 }).toFile(path.join(out, "demo-poster.webp"));
count++;
console.log(`Generated ${count} image variants.`);
