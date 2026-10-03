// Custom icons: the SVG drop zone (samples, upload, rejection, warnings) and the size slider.
//   BASE=http://localhost:3246 node --test tests/custom.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3246";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open({ width = 1440, height = 900, reduced = true } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="cx-warnings"]');
  return page;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(50); } return false; }
const T = (id) => `[data-testid="${id}"]`;
const text = (page, id) => page.$eval(T(id), (e) => e.textContent.trim());
const warn = (page) => page.$$eval(`${T("cx-warnings")} li`, (l) => l.map((x) => x.textContent.trim()));
const masks = (page, id) => page.$$eval(`${T(id)} .cx-layer`, (l) => l.map((x) => getComputedStyle(x).webkitMaskImage || getComputedStyle(x).maskImage));

test("custom: a sample is selected by default; choosing another updates the row, the tile and the warnings", async () => {
  const page = await open();
  assert.equal(await page.$eval(T("cx-mark-a"), (e) => e.getAttribute("aria-pressed")), "true");
  assert.equal(await text(page, "cx-row-label"), "badge");
  const before = (await masks(page, "cx-tile-sil")).at(-1);
  assert.match(before, /data:image\/svg\+xml/);
  await page.click(T("cx-mark-b"));
  assert.ok(await until(async () => (await text(page, "cx-row-label")) === "gem"));
  assert.equal(await page.$eval(T("cx-silhouette"), (e) => e.dataset.mark), "b");
  assert.notEqual((await masks(page, "cx-tile-sil")).at(-1), before);
  assert.equal((await masks(page, "cx-row-sil")).at(-1), (await masks(page, "cx-tile-sil")).at(-1));
  const w = await warn(page);
  assert.ok(w.some((x) => /Gradients and filters/.test(x)) && w.some((x) => /Colours/.test(x)) && w.some((x) => /Strokes/.test(x)), w.join("|"));
  await page.click(T("cx-mark-c"));
  assert.ok(await until(async () => (await warn(page)).some((x) => /Text was dropped/.test(x))));
  await page.close();
});

test("custom: uploading an SVG sets the mask, the label from the file name and parsed warnings; scripts never run", async () => {
  const page = await open();
  let dialog = false; page.on("dialog", (d) => { dialog = true; d.dismiss(); });
  const input = await page.$(T("cx-file"));
  await input.uploadFile(path.join(FX, "My-Logo.svg"));
  assert.ok(await until(async () => (await text(page, "cx-row-label")) === "my-logo"));
  assert.equal(await text(page, "cx-source"), "My-Logo");
  assert.equal(await page.$eval(T("cx-silhouette"), (e) => e.dataset.mark), "file");
  const mk = (await masks(page, "cx-tile-sil")).at(-1);
  assert.match(mk, /data:image\/svg\+xml/);
  const dec = decodeURIComponent(mk);
  assert.ok(!/<script|onload|onclick|foreignObject|<text/i.test(dec), "sanitised: " + dec.slice(0, 200));
  const w = await warn(page);
  assert.deepEqual(w.map((x) => x.split(" ")[0]).sort(), ["Colours", "Gradients", "No", "Text"]);
  assert.equal(await page.$eval(T("cx-row-sil"), (e) => e.getBoundingClientRect().width), 16);
  assert.equal(await page.$eval(`${T("cx-silhouette")} .cx-sil`, (e) => e.getBoundingClientRect().width), 72);
  assert.equal(await page.$eval(T("cx-silhouette"), (e) => e.getBoundingClientRect().width), 96);
  assert.equal(dialog, false);
  await page.close();
});

test("custom: a non-SVG file is rejected with a plain message and nothing changes", async () => {
  const page = await open();
  const before = (await masks(page, "cx-tile-sil")).at(-1);
  await (await page.$(T("cx-file"))).uploadFile(path.join(FX, "notes.txt"));
  assert.ok(await until(async () => /not an SVG/i.test(await text(page, "cx-message"))));
  assert.equal(await page.$eval(T("cx-message"), (e) => e.dataset.kind), "err");
  assert.equal(await text(page, "cx-row-label"), "badge");
  assert.equal((await masks(page, "cx-tile-sil")).at(-1), before);
  await page.close();
});

test("custom: pasting SVG text on the drop zone loads it", async () => {
  const page = await open();
  await page.focus(T("cx-zone"));
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="none" stroke="#000"/></svg>');
    document.querySelector('[data-testid="cx-zone"]').dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  assert.ok(await until(async () => (await text(page, "cx-row-label")) === "pasted"));
  assert.deepEqual((await warn(page)).map((x) => x.split(" ")[0]), ["Strokes"]);
  await page.close();
});

test("custom: a new silhouette dissolves in (two layers for 420 ms); reduced motion is instant", async () => {
  const page = await open({ reduced: false });
  await page.click(T("cx-mark-b"));
  await sleep(100);
  assert.equal((await masks(page, "cx-tile-sil")).length, 2);
  assert.ok(await until(async () => (await masks(page, "cx-tile-sil")).length === 1, 1500));
  await page.close();
  const rm = await open({ reduced: true });
  await rm.click(T("cx-mark-b"));
  await sleep(60);
  const vis = await rm.$$eval(`${T("cx-tile-sil")} .cx-layer`, (l) => l.filter((x) => getComputedStyle(x).display !== "none").length);
  assert.equal(vis, 1);
  await rm.close();
});

test("custom: the choose button and sample buttons are 44 px targets; the zone is focusable", async () => {
  const page = await open({ width: 390, height: 844 });
  for (const id of ["cx-choose", "cx-mark-a", "cx-mark-b", "cx-mark-c", "size-toy-reset"]) {
    const h = await page.$eval(T(id), (e) => e.getBoundingClientRect().height);
    assert.ok(h >= 44, `${id} is ${h}px`);
  }
  await page.focus(T("cx-zone"));
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), "cx-zone");
  await page.close();
});

test("custom: phone — no horizontal overflow, even after loading a file", async () => {
  const page = await open({ width: 390, height: 844 });
  await (await page.$(T("cx-file"))).uploadFile(path.join(FX, "My-Logo.svg"));
  await until(async () => (await text(page, "cx-row-label")) === "my-logo");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const r = await page.$eval("#custom", (e) => { const b = e.getBoundingClientRect(); return [b.left, b.right]; });
  assert.ok(r[0] >= 0 && r[1] <= 391, String(r));
  const over = await page.$$eval("#custom *", (els) => els.filter((e) => e.getBoundingClientRect().right > 391 && getComputedStyle(e).position !== "absolute").length);
  assert.equal(over, 0);
  await page.close();
});

test("custom: size slider scales the live glyph, Reset returns to 100 and disables", async () => {
  const page = await open();
  const R = T("size-toy-range"), L = T("size-toy-live"), X = T("size-toy-reset");
  await page.$eval(R, (e) => e.scrollIntoView({ block: "center" }));
  assert.equal(await page.$eval(X, (e) => e.disabled), true);
  await page.$eval(R, (e) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, "140");
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.ok(await until(() => page.$eval(L, (e) => /1\.4/.test(e.style.cssText))));
  assert.equal(await page.$eval(X, (e) => e.disabled), false);
  await page.click(X);
  assert.equal(await page.$eval(R, (e) => e.value), "100");
  assert.equal(await page.$eval(X, (e) => e.disabled), true);
  await page.close();
});

test("custom: the live row is a native-metric sidebar row (24 px, 13 px label)", async () => {
  const page = await open();
  const m = await page.$eval(T("size-toy-live"), (e) => {
    const row = e.closest(".mac-row");
    return { h: row.getBoundingClientRect().height, f: getComputedStyle(row.querySelector(".lab")).fontSize };
  });
  assert.equal(m.h, 24);
  assert.equal(m.f, "13px");
  await page.close();
});
