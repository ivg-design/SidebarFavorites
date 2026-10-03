import sharp from "sharp";
const [,, f, h="1100"] = process.argv;
const m = await sharp(f).metadata();
console.log(m.width, m.height);
const H = +h; let i = 0;
for (let t = 0; t < m.height; t += H, i++) {
  await sharp(f).extract({ left: 0, top: t, width: m.width, height: Math.min(H, m.height - t) }).toFile(f.replace(".png", `-p${i}.png`));
}
