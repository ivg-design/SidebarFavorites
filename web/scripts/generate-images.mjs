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

// Video poster: graphite field with the real manager window dimmed behind
const W = 1280, H = 720;
const win = await sharp(path.join(src, "SBFMainWindow.png")).resize({ height: 640 }).modulate({ brightness: 0.5 }).blur(6).toBuffer();
await sharp({ create: { width: W, height: H, channels: 3, background: "#2A2722" } })
  .composite([{ input: win, gravity: "east", blend: "over" }])
  .webp({ quality: 74 }).toFile(path.join(out, "demo-poster.webp"));
count++;
console.log(`Generated ${count} image variants.`);
