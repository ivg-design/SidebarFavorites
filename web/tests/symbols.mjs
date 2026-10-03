// End-to-end tests for #symbols: search lights the wall, count, Enter, chips, pause, reduced motion, phone overflow, lazy catalogue.
//   BASE=http://localhost:3245 node --test tests/symbols.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3245";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (id) => `[data-testid="${id}"]`;

async function open({ width = 1440, reduced = false, track = false } = {}) {
  const page = await browser.newPage();
  const reqs = [];
  if (track) page.on("request", (r) => reqs.push(r.url()));
  await page.setViewport({ width, height: 900 });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  page.reqs = reqs;
  return page;
}
const type = async (page, text) => { await page.focus(T("symbols-input")); await page.type(T("symbols-input"), text); await sleep(400); };
const anim = (page, sel) => page.$eval(sel, (e) => { const c = getComputedStyle(e); return { name: c.animationName, state: c.animationPlayState }; });

test("symbols: the catalogue is lazy and not in the first load", async () => {
  const page = await open({ track: true });
  const first = page.reqs.filter((u) => u.includes("/_next/static/") && u.endsWith(".js"));
  const bodies = [];
  for (const u of first) bodies.push(await page.evaluate((x) => fetch(x).then((r) => r.text()), u));
  assert.ok(!bodies.some((b) => b.includes("0.circle.fill.ar")), "sf-names.json is in a chunk loaded before the section nears view");
  await page.evaluate(() => document.querySelector("#symbols").scrollIntoView());
  await sleep(1200);
  assert.ok(page.reqs.some((u) => u.endsWith(".js") && !first.includes(u)), "no lazy chunk fetched near view");
  await page.close();
});

test("symbols: typing 'hammer' lights matches, dims the rest, updates the count", async () => {
  const page = await open();
  assert.match(await page.$eval(T("symbols-count"), (e) => e.textContent), /9,184 names on the Mac that built this page/);
  await type(page, "hammer");
  assert.equal(await page.$eval(T("symbols-stage"), (e) => e.dataset.q), "true");
  const r = await page.evaluate(() => {
    const hit = [...document.querySelectorAll(".sy-n[data-hit]")];
    const dim = document.querySelector(".sy-n:not([data-hit])");
    return { hits: hit.length, hitColor: getComputedStyle(hit[0]).color, dimColor: getComputedStyle(dim).color, allMatch: hit.every((e) => e.textContent.toLowerCase().includes("hammer")) };
  });
  assert.ok(r.hits >= 4 && r.allMatch, JSON.stringify(r));
  const lum = (c) => c.match(/\d+/g).slice(0, 3).reduce((a, v) => a + +v, 0);
  assert.ok(lum(r.hitColor) > lum(r.dimColor) + 150, `hit ${r.hitColor} vs dim ${r.dimColor}`);
  assert.match(await page.$eval(T("symbols-count"), (e) => e.textContent), /^\d+ of 9,184 names on the Mac that built this page$/);
  assert.equal((await anim(page, ".sy-row")).name, "none", "drift must stop while a query is active");
  await page.close();
});

test("symbols: Enter selects the first result and the sidebar row resolves its glyph", async () => {
  const page = await open();
  assert.equal(await page.$eval(T("symbols-row"), (e) => e.dataset.glyph), "folder");
  await type(page, "hammer");
  await page.keyboard.press("Enter");
  await sleep(300);
  assert.equal(await page.$eval(T("symbols-row"), (e) => e.dataset.glyph), "hammer.fill");
  assert.equal(await page.$eval(T("symbols-big"), (e) => e.textContent.trim()), "hammer.fill");
  await page.close();
});

test("symbols: chips are buttons; a click updates the row; an undrawable name keeps the folder and says so", async () => {
  const page = await open();
  await page.click(T("symbols-chip-music.note"));
  assert.equal(await page.$eval(T("symbols-row"), (e) => e.dataset.glyph), "music.note");
  assert.equal(await page.$eval(T("symbols-chip-music.note"), (e) => e.tagName), "BUTTON");
  await type(page, "aqi.high");
  await page.click(`${T("symbols-chips")} button`);
  assert.equal(await page.$eval(T("symbols-row"), (e) => e.dataset.glyph), "folder");
  assert.match(await page.$eval(T("symbols-note"), (e) => e.textContent), /only has silhouettes for a few dozen/);
  await page.close();
});

test("symbols: no results shows the honest message", async () => {
  const page = await open();
  await type(page, "zzzqqq");
  assert.match(await page.$eval(T("symbols-empty"), (e) => e.textContent), /No symbol is called that\. The app also matches keywords; this page only matches names\./);
  assert.match(await page.$eval(T("symbols-count"), (e) => e.textContent), /^0 of 9,184/);
  await page.close();
});

test("symbols: the pause control toggles the drift", async () => {
  const page = await open();
  assert.equal((await anim(page, ".sy-row")).state, "running");
  assert.notEqual((await anim(page, ".sy-row")).name, "none");
  assert.ok(await page.$eval(T("symbols-pause"), (e) => e.getBoundingClientRect().width >= 44 && e.getBoundingClientRect().height >= 44));
  await page.click(T("symbols-pause"));
  assert.equal(await page.$eval(T("symbols-pause"), (e) => e.getAttribute("aria-pressed")), "true");
  assert.equal((await anim(page, ".sy-row")).state, "paused");
  await page.click(T("symbols-pause"));
  assert.equal((await anim(page, ".sy-row")).state, "running");
  await page.close();
});

test("symbols: reduced motion has no drift and still searches", async () => {
  const page = await open({ reduced: true });
  assert.equal((await anim(page, ".sy-row")).name, "none");
  await type(page, "hammer");
  await page.keyboard.press("Enter");
  assert.equal(await page.$eval(T("symbols-row"), (e) => e.dataset.glyph), "hammer.fill");
  await page.close();
});

test("symbols: 390 has no horizontal overflow, 11 rows, targets >= 44", async () => {
  const page = await open({ width: 390 });
  const r = await page.evaluate(() => ({
    over: document.documentElement.scrollWidth - innerWidth,
    rows: [...document.querySelectorAll(".sy-row")].filter((e) => getComputedStyle(e).display !== "none").length,
    small: [...document.querySelectorAll(".sy-chip,.sy-pause")].filter((e) => e.getBoundingClientRect().height < 44).length,
  }));
  assert.ok(r.over <= 0, `overflow ${r.over}`); assert.equal(r.rows, 11); assert.equal(r.small, 0);
  await page.close();
});
