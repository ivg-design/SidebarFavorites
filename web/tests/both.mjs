// Everywhere: row click -> the manager row (path, name, switch), selected state, keyboard, reduced motion.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3203";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open({ width = 1440, height = 900, reduced = true, path = "/" } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  return page;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(50); } return false; }
const attr = (page, sel, a) => page.$eval(sel, (e, a) => e.getAttribute(a), a);
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.replace(/ /g, " ").trim());


const SW = '[data-testid="both-switch"]';
const TILE = '[data-testid="both-tile"]';
const ROW = '[data-testid="both-row"]';
const opacityOf = (page, sel) => page.$eval(sel, (e) => +getComputedStyle(e).opacity);

test("both: starts on; the switch is a real 44px switch labelled Keep both icons", async () => {
  const page = await open({ path: "/#both" });
  assert.equal(await attr(page, SW, "role"), "switch");
  assert.equal(await attr(page, SW, "aria-checked"), "true");
  assert.match(await text(page, SW), /Keep both icons/);
  assert.ok((await page.$eval(SW, (e) => e.getBoundingClientRect().height)) >= 44);
  assert.equal(await attr(page, TILE, "data-badge"), "true");
  assert.equal(await attr(page, ROW, "data-glyph"), "star.fill");
  await page.close();
});

test("both: off removes the pane badge but the sidebar glyph stays; on brings the badge back", async () => {
  const page = await open({ path: "/#both" });
  await page.click(SW);
  assert.equal(await attr(page, SW, "aria-checked"), "false");
  assert.equal(await attr(page, TILE, "data-badge"), "false");
  assert.equal(await attr(page, ROW, "data-glyph"), "star.fill");
  assert.ok(await until(() => page.$eval(`${TILE} .badge`, (e) => +getComputedStyle(e.closest('[data-show]')).opacity < 0.05)), "badge still visible");
  assert.match(await text(page, '[data-testid="both-status"]'), /IconBackups/);
  await page.click(SW);
  assert.equal(await attr(page, SW, "aria-checked"), "true");
  assert.equal(await attr(page, TILE, "data-badge"), "true");
  assert.match(await text(page, '[data-testid="both-status"]'), /SBF-DemoBoth/);
  await page.close();
});

test("both: keyboard (Space) toggles the switch", async () => {
  const page = await open({ path: "/#both" });
  await page.focus(SW);
  await page.keyboard.press("Space");
  assert.equal(await attr(page, SW, "aria-checked"), "false");
  await page.keyboard.press("Enter");
  assert.equal(await attr(page, SW, "aria-checked"), "true");
  await page.close();
});

test("both: no horizontal overflow at 390", async () => {
  const page = await open({ width: 390, path: "/#both" });
  const o = await page.$eval("#both", (e) => Math.max(0, ...[...e.querySelectorAll("*")].map((n) => n.getBoundingClientRect().right)) - innerWidth);
  assert.ok(o <= 0, `overflow ${o}`);
  await page.close();
});

test("both: reduced motion renders the end state at once", async () => {
  const page = await open({ reduced: true, path: "/#both" });
  await page.click(SW);
  await sleep(120);
  assert.equal(await attr(page, TILE, "data-badge"), "false");
  assert.ok((await opacityOf(page, `${TILE} .bx-layer > [data-show="true"]`)) > 0.99);
  await page.close();
});
