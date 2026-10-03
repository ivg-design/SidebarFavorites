// Favorites rail + header menu. Needs a running server:
//   BASE=http://localhost:3232 node --test tests/rail.mjs
// Set SHOTS=<dir> to also write viewport screenshots.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3232";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open(width, height = 900) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  return page;
}
const state = (page, id) => page.$eval(`[data-testid="rail-row-${id}"]`, (e) => e.dataset.state);
const shot = (page, name) => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });

test("1440: rail glyphs turn on as sections are passed", async () => {
  const page = await open(1440);
  await page.waitForSelector('[data-testid="favorites-rail"]');
  assert.equal(await state(page, "how"), "folder");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; document.getElementById("both").scrollIntoView(); });
  await page.waitForFunction(() => document.querySelector('[data-testid="rail-row-both"]').getAttribute("aria-current") === "true");
  for (const id of ["how", "custom", "everywhere", "both"]) assert.equal(await state(page, id), "visited", id);
  for (const id of ["hood", "install"]) assert.equal(await state(page, id), "folder", id);
  assert.equal(await page.$$eval('.rail-row[aria-current="true"]', (n) => n.length), 1);
  await shot(page, "rail-viewport-1440");
  await page.close();
});

test("390: rail hidden, menu opens a panel with the six rows", async () => {
  const page = await open(390);
  assert.equal(await page.$eval('[data-testid="favorites-rail"]', (e) => getComputedStyle(e).display), "none");
  await page.click('[data-testid="hd-menu"]');
  await page.waitForSelector('[data-testid="hd-panel"]');
  for (const id of ["how", "custom", "everywhere", "both", "hood", "install"]) await page.waitForSelector(`[data-testid="hd-row-${id}"]`);
  await shot(page, "rail-menu-390");
  await page.keyboard.press("Escape");
  assert.equal(await page.$('[data-testid="hd-panel"]'), null);
  await page.close();
});

test("1440: hash load marks sections above, and no row is current at scrollY 0", async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/#both", { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector('[data-testid="rail-row-both"]')?.dataset.state === "visited");
  assert.equal(await state(page, "how"), "visited");
  assert.equal(await state(page, "hood"), "folder");
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0); });
  await page.waitForFunction(() => !document.querySelector('.rail-row[aria-current="true"]'));
  await page.close();
});
