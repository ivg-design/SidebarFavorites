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

// Video poster: plain graphite field with a faint coral glow (the wireframe's dark block)
const W = 1280, H = 720;
const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="46%" r="55%"><stop offset="0" stop-color="#E8542F" stop-opacity=".16"/><stop offset="1" stop-color="#E8542F" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
await sharp({ create: { width: W, height: H, channels: 3, background: "#2A2722" } })
  .composite([{ input: glow }])
  .webp({ quality: 80 }).toFile(path.join(out, "demo-poster.webp"));
count++;
console.log(`Generated ${count} image variants.`);
