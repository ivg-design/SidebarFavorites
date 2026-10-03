// How it works: the symbol playground and the three captures.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3243";
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

test("how: the row preview follows the glyph too", async () => {
  const page = await open();
  await page.click('[data-testid="how-pick-music.note"]');
  assert.equal(await attr(page, '[data-testid="how-preview-row"]', "data-glyph"), "music.note");
  assert.ok(await until(() => page.$eval(".hw-side .hw-res-l[data-on='true']", (e) => e.getBoundingClientRect().width > 0)));
  await page.close();
});

test("how: an unknown name keeps the last glyph and shows the honest hint", async () => {
  const page = await open();
  await page.click('[data-testid="how-pick-camera"]');
  await typeNew(page, "zzz");
  assert.equal(await attr(page, PV, "data-glyph"), "camera");
  assert.equal(await text(page, '[data-testid="how-hint"]'), "Not one of the names this page can draw \u2014 the app searches all 8,300.");
  await typeNew(page, "star.fill");
  assert.equal(await attr(page, PV, "data-glyph"), "star.fill");
  assert.doesNotMatch(await text(page, '[data-testid="how-hint"]'), /Not one of/);
  await page.close();
});

test("how: quick picks are 44 px targets", async () => {
  for (const width of [1440, 390]) {
    const page = await open({ width });
    const sizes = await page.$$eval(".hw-pick", (els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.width, r.height]));
    assert.equal(sizes.length, 16);
    for (const [w, h] of sizes) assert.ok(w >= 43.9 && h >= 43.9, `${width}: pick ${w}x${h}`);
    await page.close();
  }
});

test("how: captures render at the one scale (source px x 0.65; 100% of the column on phones)", async () => {
  const want = { "how-shot-main": 559, "how-shot-add": 624, "how-shot-example": 402 };
  for (const width of [1440, 390]) {
    const page = await open({ width });
    for (const [id, display] of Object.entries(want)) {
      const el = await page.$(`[data-testid="${id}"]`);
      assert.ok(el, `${id} missing`);
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      assert.ok(await until(() => el.evaluate((e) => e.complete && e.naturalWidth > 0)), `${id} not loaded`);
      const m = await el.evaluate((e) => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, nw: e.naturalWidth, nh: e.naturalHeight, col: e.parentElement.getBoundingClientRect().width }));
      assert.ok(Math.abs((m.w / m.h) / (m.nw / m.nh) - 1) <= 0.01, `${id} aspect`);
      if (width >= 900) assert.ok(Math.abs(m.w - display) <= 1, `${id}: ${m.w} != ${display}`);
      else assert.ok(Math.abs(m.w - Math.min(display, m.col)) <= 1 && m.w <= width - 32 + 1, `${id}@${width}: ${m.w}`);
    }
    await page.close();
  }
});

test("how: no horizontal overflow at 390 and 834", async () => {
  for (const width of [390, 834]) {
    const page = await open({ width, path: "/#how-steps" });
    const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(o <= 0, `${width}: overflow ${o}`);
    const out = await page.$$eval("#how-steps *", (els) => els.filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length);
    assert.equal(out, 0, `${width}: ${out} elements past the viewport`);
    await page.close();
  }
});
