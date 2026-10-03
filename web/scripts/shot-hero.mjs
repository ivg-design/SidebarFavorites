// Dev tool: hero captures. usage: node scripts/shot-hero.mjs <baseUrl> <outDir> [width=1440] [height=900]
// Writes t0 (cold load), replay+150ms/1500ms/2700ms, picker open, and scroll positions 25/50/75/100% of the zoom-out.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const [base, dir, width = "1440", height = "900"] = process.argv.slice(2);
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = +width, h = +height;
mkdirSync(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 600 });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: `${dir}/${w}-t0-cold.png` });
  await page.waitForSelector('[data-testid="hero-stage"][data-done="true"]', { timeout: 20000 });
  await page.evaluate(() => document.querySelector('[data-testid="hero-replay"]').click());
  for (const [ms, name] of [[150, "t150"], [1350, "t1500"], [1200, "t2700"]]) { await sleep(ms); await page.screenshot({ path: `${dir}/${w}-${name}.png` }); }
  await page.evaluate(() => document.querySelector('[data-testid="hero-row-1"]').click());
  await sleep(900);
  await page.screenshot({ path: `${dir}/${w}-picker.png` });
  await page.keyboard.press("Escape");
  if (w >= 900) {
    const end = await page.evaluate(() => { const s = document.querySelector("section#top"); return s.offsetTop + s.offsetHeight - innerHeight; });
    for (const p of [0.25, 0.5, 0.75, 1]) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), end * p);
      await sleep(1400);
      await page.screenshot({ path: `${dir}/${w}-scroll${Math.round(p * 100)}.png` });
    }
  } else {
    const r = await page.evaluate(() => { const s = document.querySelector("section#top").getBoundingClientRect(); return { y: s.top + scrollY, h: s.height }; });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `${dir}/${w}-full.png`, clip: { x: 0, y: r.y, width: w, height: r.h }, captureBeyondViewport: true });
  }
  console.log("ok", dir);
} finally { await browser.close(); }
