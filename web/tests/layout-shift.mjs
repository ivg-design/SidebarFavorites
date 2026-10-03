// Owner rule: the layout never shifts horizontally when the vertical scrollbar appears or disappears.
//   BASE=http://localhost:3203 node --test tests/layout-shift.mjs   (headless Chrome has classic, space-taking scrollbars)
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3203";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

const X = (sel) => (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().left * 10) / 10 : null; };
const ANCHORS = { brand: ".dx-brand-home", rail: ".dx-rail", article: ".dx-main-wrap", toc: ".dx-toc" };

async function positions(page, path, height) {
  await page.setViewport({ width: 1440, height });
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  const out = {};
  for (const [k, sel] of Object.entries(ANCHORS)) out[k] = await page.evaluate(X(sel), sel);
  out.scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  return out;
}

test("docs: removing the scrollbar (overflow hidden) leaves header, rail, article and toc where they were", async () => {
  const page = await browser.newPage();
  const withBar = await positions(page, "/docs/custom-svg-icons", 900);
  assert.equal(withBar.scrollable, true, "long page should scroll");
  await page.evaluate(() => { document.documentElement.style.overflowY = "hidden"; });
  const noBar = {};
  for (const [k, sel] of Object.entries(ANCHORS)) noBar[k] = await page.evaluate(X(sel), sel);
  for (const k of Object.keys(ANCHORS)) assert.equal(noBar[k], withBar[k], `${k} moved: ${noBar[k]} vs ${withBar[k]}`);
  await page.close();
});

test("404: a page shorter than the viewport keeps the header brand where a scrolling page has it", async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  const long = await page.$eval(".brand", (e) => e.getBoundingClientRect().left);
  await page.setViewport({ width: 1440, height: 2400 });
  await page.goto(BASE + "/nope-404", { waitUntil: "networkidle0" });
  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  assert.equal(scrollable, false, "404 should fit a 2400px viewport");
  const short = await page.$eval(".brand", (e) => e.getBoundingClientRect().left);
  assert.equal(short, long);
  await page.close();
});

test("docs: opening the search palette (body scroll lock) does not move the header, rail or article", async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/docs/custom-svg-icons", { waitUntil: "networkidle0" });
  const before = await page.evaluate((a) => Object.fromEntries(Object.entries(a).map(([k, s]) => [k, document.querySelector(s)?.getBoundingClientRect().left])), ANCHORS);
  await page.keyboard.down("Meta"); await page.keyboard.press("k"); await page.keyboard.up("Meta");
  await page.waitForSelector('[data-testid="docs-search-input"]');
  const during = await page.evaluate((a) => Object.fromEntries(Object.entries(a).map(([k, s]) => [k, document.querySelector(s)?.getBoundingClientRect().left])), ANCHORS);
  assert.deepEqual(during, before);
  await page.close();
});

test("landing: the mobile menu scroll lock does not move the header brand", async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 834, height: 900 });
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  const before = await page.$eval(".brand", (e) => e.getBoundingClientRect().left);
  await page.click('button[aria-controls]');
  await new Promise((r) => setTimeout(r, 300));
  const during = await page.$eval(".brand", (e) => e.getBoundingClientRect().left);
  assert.equal(during, before);
  await page.close();
});
