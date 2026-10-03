// Dev tool: viewport shots of every section and interactive state, plus the hero zoom at 50/80/90/95/100 %, docs and 404.
// usage: node scripts/shot-sections.mjs <baseUrl> <outDir> [width=1440] [height=900]  (headless; Chrome is closed in finally, never killed)
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
const [base, dir, width = "1440", height = "900"] = process.argv.slice(2);
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = +width, h = +height;
mkdirSync(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 600 });
  await page.goto(base + "/", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector('[data-testid="hero-stage"][data-done="true"]', { timeout: 20000 });
  await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
  const shot = (n) => page.screenshot({ path: `${dir}/${w}-${n}.png` });
  if (w >= 900) {
    const end = await page.evaluate(() => { const s = document.querySelector("section#top"); return s.offsetTop + s.offsetHeight - innerHeight; });
    for (const p of [0.5, 0.8, 0.9, 0.95, 1]) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), end * p);
      await sleep(1400); await shot(`zoom${Math.round(p * 100)}`);
    }
  }
  // header after the stage
  await page.evaluate(() => document.getElementById("how-steps")?.scrollIntoView({ block: "start" }));
  await sleep(900); await shot("header-paper");
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 500) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await sleep(80); }
  for (const id of ["how-steps", "symbols", "custom", "everywhere", "both", "hood", "install"]) {
    await page.evaluate((i) => { const el = document.getElementById(i); el?.scrollIntoView({ block: "start" }); window.scrollBy(0, -64); }, id);
    await sleep(1000); await shot(id);
    const tall = await page.evaluate((i) => document.getElementById(i)?.getBoundingClientRect().height ?? 0, id);
    if (tall > h) { await page.evaluate(() => window.scrollBy(0, innerHeight - 100)); await sleep(700); await shot(id + "-2"); }
    if (tall > 2 * h) { await page.evaluate(() => window.scrollBy(0, innerHeight - 100)); await sleep(700); await shot(id + "-3"); }
  }
  // interactive states
  const tryClick = async (sel, name, ms = 1000) => { const ok = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.scrollIntoView({ block: "center" }); e.click(); return true; }, sel); if (ok) { await sleep(ms); await shot(name); } else console.log("missing", sel); };
  // symbol search
  const typed = await page.evaluate(() => { const i = document.querySelector('#symbols input'); if (!i) return false; i.scrollIntoView({ block: "center" }); i.focus(); return true; });
  if (typed) { await page.keyboard.type("camera"); await sleep(1200); await shot("symbols-search"); }
  const typed2 = await page.evaluate(() => { const i = document.querySelector('#how-steps input'); if (!i) return false; i.scrollIntoView({ block: "center" }); i.focus(); i.select(); return true; });
  if (typed2) { await page.keyboard.type("paperplane.fill"); await sleep(1200); await shot("how-typed"); }
  await tryClick('#everywhere button', "everywhere-row");
  await tryClick('#everywhere [role="switch"]', "everywhere-switch");
  await tryClick('#both [role="switch"]', "both-switch");
  await tryClick('#hood button', "hood-node");
  await tryClick('#install button', "install-copy", 400);
  await page.close();
  // 404 + docs
  for (const [p, n] of [["/docs", "docs"], ["/docs/custom-svg-icons", "docs-custom"], ["/docs/config-json", "docs-config"], ["/changelog", "changelog"], ["/nope", "404"]]) {
    const pg = await browser.newPage();
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 600 });
    await pg.goto(base + p, { waitUntil: "networkidle0", timeout: 60000 }); await sleep(600);
    await pg.screenshot({ path: `${dir}/${w}-${n}.png` });
    await pg.close();
  }
  console.log("ok");
} finally { await browser.close(); }
