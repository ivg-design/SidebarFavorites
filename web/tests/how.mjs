// How it works: the symbol playground and the three captures.
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

const IN = '[data-testid="how-symbol-input"]', PV = '[data-testid="how-preview-glyph"]';
async function typeNew(page, v) {
  await page.$eval(IN, (e) => { e.scrollIntoView({ block: "center" }); e.focus(); e.select(); });
  await page.keyboard.press("Backspace");
  await page.keyboard.type(v);
}

test("how: typing a known symbol name sets the preview glyph", async () => {
  const page = await open();
  await typeNew(page, "heart.fill");
  assert.equal(await attr(page, PV, "data-glyph"), "heart.fill");
  await page.close();
});

test("how: a quick pick sets the glyph and fills the input", async () => {
  const page = await open();
  await page.click('[data-testid="how-pick-camera"]');
  assert.equal(await attr(page, PV, "data-glyph"), "camera");
  assert.equal(await page.$eval(IN, (e) => e.value), "camera");
  await page.close();
});

test("how: an unknown name keeps the last glyph and shows the hint", async () => {
  const page = await open();
  await page.click('[data-testid="how-pick-camera"]');
  await typeNew(page, "zzz");
  assert.equal(await attr(page, PV, "data-glyph"), "camera");
  const hint = await page.$eval(".hw-hint", (e) => e.textContent);
  assert.match(hint, /Not one of the quick picks/);
  await page.close();
});

test("how: the three captures render whole (aspect ratio kept, MainWindow >= 559 px)", async () => {
  const page = await open();
  for (const n of ["SBFMainWindow", "SBFAddFavoriteWindow", "SFSymbolBrowser"]) {
    const el = await page.$(`img[src*="${n}"]`);
    assert.ok(el, `${n} missing`);
    await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
    assert.ok(await until(() => el.evaluate((e) => e.complete && e.naturalWidth > 0)), `${n} not loaded`);
    const m = await el.evaluate((e) => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, nw: e.naturalWidth, nh: e.naturalHeight }));
    const ratio = (m.w / m.h) / (m.nw / m.nh);
    assert.ok(Math.abs(ratio - 1) <= 0.01, `${n} aspect off by ${ratio}`);
    if (n === "SBFMainWindow") assert.ok(m.w >= 559, `MainWindow ${m.w}px wide`);
  }
  await page.close();
});
