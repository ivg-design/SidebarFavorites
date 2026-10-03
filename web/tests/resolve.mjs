// "resolve" on entry: captures and vivid panels start grey/soft below the fold and resolve once at ~35% in view.
//   BASE=http://localhost:3276 node --test tests/resolve.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3203";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

const SEL = '[data-testid="how-shot-example"]';
const state = (page, sel) => page.evaluate((s) => document.querySelector(s).closest("[data-resolve]").dataset.resolve, sel);

async function open(reduce) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  if (reduce) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.evaluateOnNewDocument(() => addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "html{scroll-behavior:auto!important}"; document.head.append(s); }));
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  return page;
}

test("below-fold capture starts off, resolves once in view, filter goes grey -> none, no layout shift", async () => {
  const page = await open(false);
  assert.equal(await state(page, SEL), "off");
  const f0 = await page.$eval(SEL, (e) => getComputedStyle(e).filter);
  assert.match(f0, /grayscale|saturate/);
  const rect = () => page.$eval(SEL, (e) => { return [e.offsetWidth, e.offsetHeight]; });
  // lazy-image load growth is a separate, pre-existing shift: load it first so only the resolve is measured
  await page.$eval(SEL, (e) => { e.loading = "eager"; return e.decode().catch(() => {}); });
  const before = await rect();
  await page.$eval(SEL, (e) => e.scrollIntoView({ block: "center" }));
  await page.waitForFunction((s) => document.querySelector(s).closest("[data-resolve]").dataset.resolve === "on", { timeout: 3000 }, SEL);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(await page.$eval(SEL, (e) => getComputedStyle(e).filter), "none");
  assert.deepEqual(await rect(), before, "figure rect unchanged");
  await page.close();
});

test("a vivid panel below the fold resolves too", async () => {
  const page = await open(false);
  const st = () => page.$eval(".ev-stage", (e) => e.dataset.resolve);
  assert.equal(await st(), "off");
  await page.$eval(".ev-stage", (e) => e.scrollIntoView({ block: "center" }));
  await page.waitForFunction(() => document.querySelector(".ev-stage").dataset.resolve === "on", { timeout: 3000 });
  await page.close();
});

test("reduced motion renders the end state at once", async () => {
  const page = await open(true);
  assert.equal(await state(page, SEL), "on");
  assert.equal(await page.$eval(SEL, (e) => getComputedStyle(e).filter), "none");
  assert.equal(await page.$eval(".ev-stage", (e) => e.dataset.resolve), "on");
  await page.close();
});
