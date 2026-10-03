// Dev tool: headless full-page screenshot (puppeteer-core + system Chrome), true viewport widths,
// optional reduced-motion emulation, a scroll pass so in-view animations and lazy images fire.
// usage: node scripts/shot.mjs <url> <out.png> [width=1440] [reduced=0|1] [clickSelector]
import puppeteer from "puppeteer-core";

const [url, out, width = "1440", reduced = "0", click] = process.argv.slice(2);
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = +width;
const browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1, isMobile: w < 600 });
  if (reduced === "1") await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await sleep(1500);
  if (click) { await page.evaluate((s) => document.querySelector(s)?.click(), click); await sleep(1200); }
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 600) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await sleep(120); }
  await sleep(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`${out} ${w}x${total} horizontal-overflow=${overflow}`);
} finally {
  await browser.close();
}
