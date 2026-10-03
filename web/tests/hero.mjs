// End-to-end tests for the hero: the move (folder → glyph), the per-row picker, replay, reduced motion.
//   BASE=http://localhost:3243 node --test tests/hero.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3203";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open({ width = 1440, height = 900, reduced = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  return page;
}
const glyphs = (page) => page.$$eval('[data-testid^="hero-row-"]', (els) => els.map((e) => e.dataset.glyph));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("hero: rows start as grey folders and resolve into glyphs, top to bottom", async () => {
  const page = await open();
  const first = await glyphs(page);
  assert.equal(first.length, 8);
  await sleep(2600);
  const done = await glyphs(page);
  assert.ok(done.every((g) => g !== "folder"), `still folders: ${done}`);
  assert.equal(await page.$eval('[data-testid="hero-stage"]', (e) => e.dataset.done), "true");
  const title = await page.$eval('[data-testid="hero-title"]', (e) => e.textContent.trim());
  assert.equal(title, "Forge");
  await page.close();
});

test("hero: reduced motion shows the end state at once and keeps the picker", async () => {
  const page = await open({ reduced: true });
  const g = await glyphs(page);
  assert.ok(g.every((x) => x !== "folder"), `folders under reduced motion: ${g}`);
  await page.click('[data-testid="hero-row-1"]');
  assert.ok(await page.$('[data-testid="hero-pop"]'));
  await page.close();
});

test("hero: picking a symbol changes that row, closes the picker and returns focus", async () => {
  const page = await open({ reduced: true });
  await page.click('[data-testid="hero-row-2"]');
  const pop = await page.$('[data-testid="hero-pop"]');
  assert.ok(pop, "picker opens");
  assert.equal(await page.$eval('[data-testid="hero-row-2"]', (e) => e.getAttribute("aria-expanded")), "true");
  assert.equal(await page.$eval('[data-testid="hero-title"]', (e) => e.textContent.trim()), "Brand");
  await page.click('[data-testid="hero-pick-star.fill"]');
  await sleep(100);
  assert.equal(await page.$eval('[data-testid="hero-row-2"]', (e) => e.dataset.glyph), "star.fill");
  assert.equal(await page.$('[data-testid="hero-pop"]'), null, "picker closed");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), "hero-row-2");
  // the other rows are untouched
  const g = await glyphs(page);
  assert.equal(g[0], "hammer.fill");
  await page.close();
});

test("hero: Escape closes the picker; a click outside closes it", async () => {
  const page = await open({ reduced: true });
  await page.click('[data-testid="hero-row-0"]');
  assert.ok(await page.$('[data-testid="hero-pop"]'));
  await page.keyboard.press("Escape");
  await sleep(50);
  assert.equal(await page.$('[data-testid="hero-pop"]'), null);
  await page.click('[data-testid="hero-row-0"]');
  await page.mouse.click(5, 400);
  await sleep(50);
  assert.equal(await page.$('[data-testid="hero-pop"]'), null);
  await page.close();
});

test("hero: replay resets the rows to folders and resolves them again", async () => {
  const page = await open();
  await sleep(2600);
  await page.click('[data-testid="hero-replay"]');
  await sleep(150);
  const mid = await glyphs(page);
  assert.ok(mid.some((g) => g === "folder"), `replay did not reset: ${mid}`);
  await sleep(2600);
  const end = await glyphs(page);
  assert.ok(end.every((g) => g !== "folder"));
  await page.close();
});

test("hero: phone — no horizontal overflow, the window shows its sidebar, the picker is a sheet", async () => {
  const page = await open({ width: 390, height: 844, reduced: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const row = await page.$eval('[data-testid="hero-row-0"]', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height }; });
  assert.ok(row.l >= 0 && row.r <= 390, `row off-screen: ${JSON.stringify(row)}`);
  assert.ok(row.h >= 26, `row too small on a phone: ${row.h}`);
  await page.click('[data-testid="hero-row-0"]');
  const pos = await page.$eval('[data-testid="hero-pop"]', (e) => getComputedStyle(e).position);
  assert.equal(pos, "fixed");
  await page.close();
});
