// Header: sticky bar, active section, mobile menu.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3249";
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

const T = '[data-testid="hd-';

test("header: 64 px sticky bar, six section links, aria-current follows scroll", async () => {
  const page = await open();
  const h = await page.$eval('[data-testid="header"]', (e) => ({ h: e.getBoundingClientRect().height, pos: getComputedStyle(e).position }));
  assert.equal(h.h, 64);
  assert.equal(h.pos, "sticky");
  const links = await page.$$eval('nav[aria-label="Sections"] a', (a) => a.map((x) => x.dataset.id));
  assert.deepEqual(links, ["how", "symbols", "custom", "everywhere", "both", "hood"]);
  await page.evaluate(() => document.getElementById("custom").scrollIntoView());
  assert.ok(await until(() => page.$eval(T + 'link-custom"]', (e) => e.getAttribute("aria-current") === "true")), "custom not current");
  assert.equal(await page.$eval('[data-testid="header"]', (e) => e.getBoundingClientRect().top), 0, "header stays stuck");
  await page.close();
});

test("header: transparent with light links over the dark hero, paper after 1.5 viewports", async () => {
  const page = await open();
  const st = () => page.$eval('[data-testid="header"]', (e) => { const c = getComputedStyle(e); const a = getComputedStyle(e.querySelector(".nav-links a")); return { dark: e.dataset.onDark, bg: c.backgroundColor, link: a.color }; });
  let s = await st();
  assert.equal(s.dark, "true");
  assert.match(s.bg, /rgba\(0, 0, 0, 0\)|transparent/);
  const lum = (c) => c.match(/\d+/g).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3;
  assert.ok(lum(s.link) > 180, "links are light on dark: " + s.link);
  await page.evaluate(() => window.scrollTo({ top: innerHeight * 1.5, behavior: "instant" }));
  assert.ok(await until(async () => (await st()).dark === "false"), "still dark after scroll");
  await sleep(400);
  s = await st();
  assert.equal(s.bg, "rgb(241, 240, 234)");
  assert.ok(lum(s.link) < 140, "links are dark on paper: " + s.link);
  await page.close();
});

test("header: on docs and changelog the bar is paper from the start", async () => {
  for (const p of ["/docs", "/changelog"]) {
    const page = await open({ path: p });
    assert.equal(await page.$eval(".dx-top", (e) => getComputedStyle(e).position), "sticky");
    assert.equal(await page.$eval(".dx-brand-home img", (e) => e.getBoundingClientRect().width), 54);
    await page.close();
  }
});

test("header: brand icon is 54 px and links home; Docs link present", async () => {
  const page = await open();
  assert.equal(await page.$eval(".nav-brand img", (e) => e.getBoundingClientRect().width), 54);
  assert.match(await attr(page, ".nav-brand", "href"), /\/$/);
  assert.match(await attr(page, T + 'link-docs"]', "href"), /\/docs$/);
  await page.close();
});

test("header: Install links to #install", async () => {
  const page = await open();
  assert.match(await attr(page, T + 'install"]', "href"), /#install$/);
  await page.close();
});

test("header: 390 menu opens, locks scroll, Escape closes and returns focus", async () => {
  const page = await open({ width: 390 });
  assert.equal(await page.$eval(T + 'panel"]', (e) => e.hidden), true);
  assert.equal(await page.$eval(T + 'menu"]', (e) => e.getBoundingClientRect().height), 44);
  await page.focus(T + 'menu"]');
  await page.keyboard.press("Enter");
  assert.equal(await attr(page, T + 'menu"]', "aria-expanded"), "true");
  assert.equal(await page.$eval(T + 'panel"]', (e) => e.hidden), false);
  assert.equal(await page.evaluate(() => document.documentElement.style.overflow), "hidden");
  await page.keyboard.press("Escape");
  assert.ok(await until(() => page.$eval(T + 'panel"]', (e) => e.hidden)));
  assert.equal(await attr(page, T + 'menu"]', "aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.documentElement.style.overflow), "");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), "hd-menu");
  await page.close();
});
