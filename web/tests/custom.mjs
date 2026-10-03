// Custom icons: mark picker warnings and the size slider.
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

const warn = (page) => page.$$eval('[data-testid="cx-warnings"] li', (l) => l.map((x) => x.textContent.trim()));

test("custom: Gem shows silhouette b with the colour and hairline warnings", async () => {
  const page = await open();
  await page.click('[data-testid="cx-mark-b"]');
  assert.equal(await attr(page, '[data-testid="cx-silhouette"]', "data-mark"), "b");
  const w = await warn(page);
  assert.equal(w.length, 2);
  assert.ok(/Colours|gradients/i.test(w[0]) && /hairline/i.test(w[1]), w.join("|"));
  await page.close();
});

test("custom: Wordmark has two warnings including live text; Badge has one", async () => {
  const page = await open();
  await page.click('[data-testid="cx-mark-c"]');
  const c = await warn(page);
  assert.equal(c.length, 2);
  assert.ok(c.some((x) => /live text/i.test(x)));
  await page.click('[data-testid="cx-mark-a"]');
  assert.equal((await warn(page)).length, 1);
  assert.equal(await attr(page, '[data-testid="cx-silhouette"]', "data-mark"), "a");
  await page.close();
});

test("custom: size slider scales the live glyph, Reset returns to 100 and disables", async () => {
  const page = await open();
  const R = '[data-testid="size-toy-range"]', L = '[data-testid="size-toy-live"]', X = '[data-testid="size-toy-reset"]';
  await page.$eval(R, (e) => e.scrollIntoView({ block: "center" }));
  assert.equal(await page.$eval(X, (e) => e.disabled), true);
  await page.$eval(R, (e) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, "140");
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.ok(await until(() => page.$eval(L, (e) => /1\.4/.test(e.style.transform || getComputedStyle(e).transform) || getComputedStyle(e).getPropertyValue("--k").trim() === "1.4")));
  const t = await page.$eval(L, (e) => ({ s: e.style.cssText, c: getComputedStyle(e).transform }));
  assert.ok(/1\.4/.test(t.s + t.c), JSON.stringify(t));
  assert.equal(await page.$eval(X, (e) => e.disabled), false);
  await page.click(X);
  assert.equal(await page.$eval(R, (e) => e.value), "100");
  assert.equal(await page.$eval(X, (e) => e.disabled), true);
  await page.close();
});

test("custom: the live row is a native-metric sidebar row (24 px, 13 px label)", async () => {
  const page = await open();
  const m = await page.$eval('[data-testid="size-toy-live"]', (e) => {
    const row = e.closest(".mac-row");
    return { h: row.getBoundingClientRect().height, f: getComputedStyle(row.querySelector(".lab")).fontSize };
  });
  assert.equal(m.h, 24);
  assert.equal(m.f, "13px");
  await page.close();
});
