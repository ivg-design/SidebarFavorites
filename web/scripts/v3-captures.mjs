// Lead's verification: full pages at four widths plus the hero's timeline and scroll states, headless.
// usage: BASE=http://localhost:3263 node scripts/v3-captures.mjs [outdir=.reviews/v3/lead]
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:3263";
const OUT = process.argv[2] || ".reviews/v3/lead";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
try {
  for (const [w, h] of [[1440, 900], [1280, 800], [834, 1112], [390, 844]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 600 });
    await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 60000 });
    await page.screenshot({ path: `${OUT}/hero-${w}-t0.png` });
    await sleep(1400); await page.screenshot({ path: `${OUT}/hero-${w}-t1.png` });
    await sleep(1400); await page.screenshot({ path: `${OUT}/hero-${w}-t2.png` });
    const secH = await page.evaluate(() => document.getElementById("top")?.getBoundingClientRect().height ?? 0);
    for (const p of [0.33, 0.66, 1]) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, secH - h) * p);
      await sleep(900); await page.screenshot({ path: `${OUT}/hero-${w}-scroll${Math.round(p * 100)}.png` });
    }
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 600) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await sleep(100); }
    await sleep(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
    await page.screenshot({ path: `${OUT}/home-${w}.png`, fullPage: true });
    console.log(`${w}: height ${H} overflow ${overflow}`);
    await page.close();
  }
} finally { await browser.close(); }
