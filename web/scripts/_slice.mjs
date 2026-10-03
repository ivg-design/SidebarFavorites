import sharp from "sharp";
const [inp, outp, h = "1100", scale = "0.5"] = process.argv.slice(2);
const img = sharp(inp); const m = await img.metadata();
const H = +h; let i = 0;
for (let y = 0; y < m.height; y += H, i++) {
  const hh = Math.min(H, m.height - y);
  await sharp(inp).extract({ left: 0, top: y, width: m.width, height: hh }).resize(Math.round(m.width * +scale)).png().toFile(`${outp}-${String(i).padStart(2,"0")}.png`);
}
console.log(i, "slices");
