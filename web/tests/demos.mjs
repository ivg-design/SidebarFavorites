// End-to-end tests for the Keeping both icons demo. Needs a running server:
//   BASE=http://localhost:3233 node --test tests/demos.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3203";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open(path, { width = 1440, height = 900, reduced = true } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  return page;
}
const state = (page) => page.evaluate(() => ({
  tile: document.querySelector('[data-testid="both-tile"]').dataset.folder,
  row: document.querySelector('[data-testid="both-row"]').dataset.glyph,
  status: document.querySelector('[data-testid="both-status"]').textContent.trim(),
  checked: ["keep", "remove", "leave"].filter((m) => document.querySelector(`[data-testid="both-choice-${m}"]`).checked),
}));

test("both icons: radiogroup and default state is Keep", async () => {
  const page = await open("/");
  assert.ok(await page.$('[role="radiogroup"] [data-testid="both-choice-keep"]'));
  const s = await state(page);
  assert.deepEqual([s.tile, s.row, s.checked], ["custom", "star", ["keep"]]);
  assert.match(s.status, /SBF-DemoBoth registered/);
  await page.close();
});

test("both icons: each choice changes tile, row glyph and status", async () => {
  const page = await open("/");
  await page.$eval('[data-testid="both-tile"]', (e) => e.scrollIntoView({ block: "center" }));
  await page.click('[data-testid="both-choice-remove"]');
  let s = await state(page);
  assert.deepEqual([s.tile, s.row], ["plain", "star"]);
  assert.match(s.status, /Folder icon removed.*IconBackups/);
  await page.click('[data-testid="both-choice-leave"]');
  s = await state(page);
  assert.deepEqual([s.tile, s.row], ["custom", "folder"]);
  assert.match(s.status, /Sidebar glyph lost.*Refresh/);
  await page.click('[data-testid="both-choice-keep"]');
  s = await state(page);
  assert.deepEqual([s.tile, s.row, s.checked], ["custom", "star", ["keep"]]);
  await page.close();
});

test("both icons: arrow keys move the choice", async () => {
  const page = await open("/");
  await page.$eval('[data-testid="both-tile"]', (e) => e.scrollIntoView({ block: "center" }));
  await page.focus('[data-testid="both-choice-keep"]');
  await page.keyboard.press("ArrowDown");
  assert.deepEqual((await state(page)).checked, ["remove"]);
  await page.keyboard.press("ArrowDown");
  assert.deepEqual((await state(page)).checked, ["leave"]);
  await page.keyboard.press("ArrowUp");
  assert.deepEqual((await state(page)).checked, ["remove"]);
  await page.close();
});

test("both icons: choices are 44px rows and nothing overflows at 390", async () => {
  const page = await open("/", { width: 390, height: 800 });
  const boxes = await page.$$eval('[role="radiogroup"] label', (l) => l.map((e) => e.getBoundingClientRect().height));
  assert.equal(boxes.length, 3);
  assert.ok(boxes.every((h) => h >= 44), `short rows: ${boxes}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.close();
});
