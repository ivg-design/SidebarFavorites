// End-to-end tests for the hero: the move (grey folders -> glyphs, letters, colour), the picker, replay, reduced motion,
// the scroll-driven zoom-out into the resting Finder window, and the phone layout.
//   BASE=http://localhost:3244 node --test tests/hero.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3244";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open({ width = 1440, height = 900, reduced = false, hash = "" } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + "/" + hash, { waitUntil: "networkidle0" });
  return page;
}
const glyphs = (page) => page.$$eval('[data-testid^="hero-row-"]', (els) => els.map((e) => e.dataset.glyph));
const letters = (page) => page.$$eval(".hx-ch", (els) => els.map((e) => e.dataset.on));
const sat = (page) => page.$eval('[data-testid="hero-vivid"]', (e) => +getComputedStyle(e).getPropertyValue("--sat"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (page) => page.waitForSelector('[data-testid="hero-stage"][data-done="true"]', { timeout: 15000 });
const instant = (page, y) => page.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
const endY = (page) => page.evaluate(() => { const s = document.querySelector("section#top"); return s.offsetTop + s.offsetHeight - innerHeight; });

test("hero: the move — rows, headline letters and colour resolve together, top to bottom", async () => {
  const page = await open();
  await done(page);
  // replay in-page and sample every frame so the check does not depend on CDP latency
  const log = await page.evaluate(() => new Promise((resolve) => {
    let rows = [...document.querySelectorAll('[data-testid^="hero-row-"]')];
    const chs = [...document.querySelectorAll(".hx-ch")];
    const fs = [...document.querySelectorAll(".hx-f")];
    const vivid = document.querySelector('[data-testid="hero-vivid"]');
    let t0 = 0;
    const firstRow = rows.map(() => null), firstCh = chs.map(() => null), firstF = fs.map(() => null);
    const start = { sat: 1 };
    let skew = 0, endSat = 0;
    document.querySelector('[data-testid="hero-replay"]').click();
    const tick = () => {
      rows = [...document.querySelectorAll('[data-testid^="hero-row-"]')]; // replay remounts the column
      if (!t0) { if (rows.every((r) => r.dataset.glyph === "folder")) { t0 = performance.now(); start.sat = +getComputedStyle(vivid).getPropertyValue("--sat"); } requestAnimationFrame(tick); return; }
      const t = performance.now() - t0;
      rows.forEach((r, i) => { if (firstRow[i] === null && r.dataset.glyph !== "folder") firstRow[i] = t; });
      chs.forEach((c, i) => { if (firstCh[i] === null && c.dataset.on === "true") firstCh[i] = t; });
      fs.forEach((f, i) => { if (firstF[i] === null && f.dataset.on === "true") firstF[i] = t; });
      chs.forEach((c, i) => { if ((c.dataset.on === "true") !== (rows[i].dataset.glyph !== "folder")) skew++; });
      endSat = +getComputedStyle(vivid).getPropertyValue("--sat");
      if (t < 3000) requestAnimationFrame(tick); else resolve({ start, firstRow, firstCh, firstF, skew, endSat });
    };
    requestAnimationFrame(tick);
  }));
  assert.ok(log.firstRow.every((t) => t !== null), `rows never resolved: ${log.firstRow}`);
  for (let i = 1; i < 8; i++) assert.ok(log.firstRow[i] >= log.firstRow[i - 1], `row ${i} resolved before row ${i - 1}`);
  assert.ok(log.firstRow[0] > 800 && log.firstRow[0] < 1200, `row 0 should resolve near 900 ms, got ${log.firstRow[0]}`);
  assert.ok(log.firstRow[7] - log.firstRow[0] > 500 && log.firstRow[7] - log.firstRow[0] < 800, "rows are ~90 ms apart");
  for (let k = 0; k < 7; k++) {
    assert.ok(Math.abs(log.firstCh[k] - log.firstRow[k]) < 40, `letter ${k} not in step with row ${k}`);
    assert.ok(Math.abs(log.firstF[k] - log.firstRow[k]) < 40, `folder ${k} not in step with row ${k}`);
  }
  assert.ok(log.skew <= 2, `letters and rows drifted apart (${log.skew} frames)`);
  assert.equal(log.start.sat, 0, "the wallpaper starts grey");
  assert.ok(log.endSat > 0.98, `--sat should reach 1, got ${log.endSat}`);
  assert.equal(await page.$eval('[data-testid="hero-stage"]', (e) => e.dataset.done), "true");
  assert.deepEqual(await letters(page), Array(7).fill("true"));
  await page.close();
});

test("hero: t=0 is grey folders, a grey wallpaper and the illegible word", async () => {
  const page = await open();
  await done(page);
  await page.evaluate(() => document.querySelector('[data-testid="hero-replay"]').click());
  await sleep(60);
  assert.ok((await glyphs(page)).every((g) => g === "folder"), "rows start as folders");
  assert.deepEqual(await letters(page), Array(7).fill("false"));
  assert.ok((await sat(page)) < 0.05, "wallpaper starts grey");
  const folders = await page.$$eval(".hx-f", (els) => els.map((e) => ({ on: e.dataset.on, w: e.getBoundingClientRect().width })));
  assert.equal(folders.length, 7);
  assert.ok(folders.every((f) => f.on === "false" && f.w > 20), "seven grey folders over the word");
  await page.close();
});

test("hero: the headline reads as one sentence, in three lines, and never shifts", async () => {
  const page = await open();
  const sr = await page.$eval("#hero-title-h1 .sr-only", (e) => e.textContent);
  assert.equal(sr, "Your sidebar, finally legible.");
  assert.equal(await page.$eval(".hx-lines", (e) => e.getAttribute("aria-hidden")), "true");
  const tops = await page.evaluate(() => [".hx-l:not(.hx-l2)", ".hx-l2", ".hx-word"].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().top)));
  assert.ok(tops[0] < tops[1] && tops[1] < tops[2], `three lines expected: ${tops}`);
  assert.equal(await page.$eval(".hx-word", (e) => getComputedStyle(e).fontStyle), "italic");
  assert.ok((await page.$eval(".hx-word", (e) => e.textContent)).endsWith("."));
  await page.close();
});

test("hero: reduced motion shows the end state at once and keeps the picker", async () => {
  const page = await open({ reduced: true });
  const g = await glyphs(page);
  assert.ok(g.every((x) => x !== "folder"), `folders under reduced motion: ${g}`);
  assert.deepEqual(await letters(page), Array(7).fill("true"));
  assert.equal(await sat(page), 1);
  assert.equal(await page.$eval('[data-testid="hero-stage"]', (e) => e.dataset.done), "true");
  assert.equal(await page.$eval(".hx-stage", (e) => getComputedStyle(e).position), "relative", "no sticky stage under reduced motion");
  assert.equal(await page.$eval("section#top", (e) => e.getBoundingClientRect().height < 3 * innerHeight), true);
  await page.click('[data-testid="hero-row-1"]');
  assert.ok(await page.$('[data-testid="hero-pop"]'));
  await page.close();
});

test("hero: picking a symbol changes that row, closes the picker and returns focus", async () => {
  const page = await open({ reduced: true });
  await page.click('[data-testid="hero-row-2"]');
  const pop = await page.$('[data-testid="hero-pop"]');
  assert.ok(pop, "picker opens");
  assert.equal(await page.$eval('[data-testid="hero-row-2"]', (e) => e.getAttribute("aria-expanded")), "true");
  await page.click('[data-testid="hero-pick-star.fill"]');
  await sleep(100);
  assert.equal(await page.$eval('[data-testid="hero-row-2"]', (e) => e.dataset.glyph), "star.fill");
  assert.equal(await page.$('[data-testid="hero-pop"]'), null, "picker closed");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), "hero-row-2");
  const g = await glyphs(page);
  assert.equal(g[0], "hammer.fill");
  await page.close();
});

test("hero: the picker stays inside the stage and picking works in the scrub layout too", async () => {
  const page = await open();
  await done(page);
  for (const i of [0, 7]) {
    await page.click(`[data-testid="hero-row-${i}"]`);
    await sleep(250);
    const r = await page.evaluate(() => { const p = document.querySelector('[data-testid="hero-pop"]').getBoundingClientRect(), s = document.querySelector('[data-testid="hero-stage"]').getBoundingClientRect(); return { pt: p.top - s.top, pb: s.bottom - p.bottom, pl: p.left - s.left, pr: s.right - p.right }; });
    assert.ok(r.pt >= 0 && r.pb >= 0 && r.pl >= 0 && r.pr >= 0, `picker left the stage: ${JSON.stringify(r)}`);
    await page.keyboard.press("Escape");
    await sleep(60);
  }
  await page.click('[data-testid="hero-row-3"]');
  await page.click('[data-testid="hero-pick-heart.fill"]');
  await sleep(100);
  assert.equal(await page.$eval('[data-testid="hero-row-3"]', (e) => e.dataset.glyph), "heart.fill");
  await page.close();
});

test("hero: Escape closes the picker; a click outside closes it", async () => {
  const page = await open({ reduced: true });
  await page.click('[data-testid="hero-row-0"]');
  assert.ok(await page.$('[data-testid="hero-pop"]'));
  await page.keyboard.press("Escape");
  await sleep(50);
  assert.equal(await page.$('[data-testid="hero-pop"]'), null);
  await page.click('[data-testid="hero-row-0"]');
  await page.mouse.click(900, 700);
  await sleep(50);
  assert.equal(await page.$('[data-testid="hero-pop"]'), null);
  await page.close();
});

test("hero: replay resets the rows to folders and resolves them again", async () => {
  const page = await open();
  await done(page);
  await page.click('[data-testid="hero-replay"]');
  await sleep(150);
  const mid = await glyphs(page);
  assert.ok(mid.some((g) => g === "folder"), `replay did not reset: ${mid}`);
  await done(page);
  const end = await glyphs(page);
  assert.ok(end.every((g) => g !== "folder"));
  await page.close();
});

test("hero: the stage owns the fold at 1440x900 and the column is flush left at poster scale", async () => {
  const page = await open();
  await done(page);
  const m = await page.evaluate(() => {
    const st = document.querySelector('[data-testid="hero-stage"]').getBoundingClientRect();
    const box = document.querySelector(".hx-colbox"), col = document.querySelector('[data-testid="hero-col"]').getBoundingClientRect();
    const hit = document.elementFromPoint(720, innerHeight - 2);
    return { stTop: st.top, stBottom: st.bottom, vh: innerHeight, z: box.offsetWidth / 204, colLeft: col.left, colTop: col.top, hitInHero: !!hit?.closest("section#top"), pos: getComputedStyle(document.querySelector('[data-testid="hero-stage"]')).position };
  });
  assert.equal(m.pos, "sticky");
  assert.ok(Math.abs(m.stTop) < 1 && m.stBottom >= m.vh - 1, `stage should fill 0..vh: ${JSON.stringify(m)}`);
  assert.ok(m.hitInHero, "nothing of the page below is visible at the fold");
  assert.ok(m.z > 2.2 && m.z <= 2.6, `z should be ~2.3-2.4 at 1440x900, got ${m.z}`);
  assert.ok(Math.abs(m.colLeft) < 1 && Math.abs(m.colTop - 64) < 1, `column is flush top-left of the stage: ${JSON.stringify(m)}`);
  await page.close();
});

test("hero: zoom-out — the column scrubs into the resting Finder window and the How copy lands", async () => {
  const page = await open();
  await done(page);
  const op = (sel) => page.$eval(sel, (e) => +getComputedStyle(e).opacity);
  assert.equal(await op('[data-testid="hero-rest"]'), 0, "window hidden at the start");
  assert.equal(await op(".hx-head"), 1);
  const end = await endY(page);
  // mid-way: the headline has gone, the column is smaller than at the start and still opaque
  await instant(page, end * 0.5);
  await sleep(1500);
  assert.ok((await op(".hx-head")) < 0.01, "headline gone by 50%");
  const z50 = await page.$eval('[data-testid="hero-col"]', (e) => e.getBoundingClientRect().width / 204);
  assert.ok(z50 < 2 && z50 > 1.3, `column should be shrinking, z=${z50}`);
  // 100%: the poster column's rows land exactly on the resting window's rows (the swap is invisible)
  await instant(page, end);
  await sleep(1600);
  const d = await page.evaluate(() => [3, 7].map((i) => {
    const a = document.querySelector(`[data-testid="hero-row-${i}"]`).getBoundingClientRect(), b = document.querySelector(`[data-testid="hero-rest-row-${i}"]`).getBoundingClientRect();
    return { dx: Math.abs(a.left - b.left), dy: Math.abs(a.top - b.top), dw: Math.abs(a.width - b.width) };
  }));
  for (const r of d) assert.ok(r.dx < 2 && r.dy < 2 && r.dw < 2, `column and window sidebar do not coincide: ${JSON.stringify(d)}`);
  assert.ok((await op('[data-testid="hero-rest"]')) > 0.98, "window at rest");
  assert.ok((await op(".hx-how")) > 0.98, "How copy visible");
  assert.ok((await op('[data-testid="hero-col"]')) < 0.02, "poster column gone");
  const how = await page.$eval("#how", (e) => { const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, vh: innerHeight, vw: innerWidth, txt: e.textContent }; });
  assert.equal(how.txt, "Pick a folder. Pick an icon. Add.");
  assert.ok(how.t > 64 && how.b < how.vh && how.l >= 0 && how.r <= how.vw, `#how must be on screen: ${JSON.stringify(how)}`);
  // the picker still works on the resting window and the glyph survives the zoom-out
  await page.click('[data-testid="hero-rest-row-4"]');
  await page.click('[data-testid="hero-pick-flag.fill"]');
  await sleep(100);
  assert.equal(await page.$eval('[data-testid="hero-rest-row-4"]', (e) => e.dataset.glyph), "flag.fill");
  await instant(page, 0);
  await sleep(1500);
  assert.equal(await page.$eval('[data-testid="hero-row-4"]', (e) => e.dataset.glyph), "flag.fill", "picked glyph survives");
  assert.equal(await op('[data-testid="hero-rest"]'), 0);
  await page.close();
});

test("hero: the header's How it works link lands on the resting state", async () => {
  const page = await open();
  await done(page);
  await page.click('[data-testid="hd-link-how"]');
  await sleep(3000);
  const end = await endY(page);
  const y = await page.evaluate(() => scrollY);
  assert.ok(Math.abs(y - end) < 4, `scrollY ${y} should be at the end of the range ${end}`);
  assert.ok((await page.$eval('[data-testid="hero-rest"]', (e) => +getComputedStyle(e).opacity)) > 0.98);
  await page.close();
});

test("hero: loading /#how lands on the resting state", async () => {
  const page = await open({ hash: "#how" });
  await sleep(2500);
  const end = await endY(page);
  const y = await page.evaluate(() => scrollY);
  assert.ok(Math.abs(y - end) < 4, `scrollY ${y} vs ${end}`);
  assert.ok((await page.$eval("#how", (e) => +getComputedStyle(e.parentElement).opacity)) > 0.98);
  await page.close();
});

test("hero: phone — no sticky, no overflow, headline plus the sidebar rows in the first screen, picker is a sheet", async () => {
  const page = await open({ width: 390, height: 844 });
  await done(page);
  assert.equal(await page.$eval('[data-testid="hero-stage"]', (e) => getComputedStyle(e).position), "relative");
  const over = await page.evaluate(() => [...document.querySelectorAll("section#top *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest(".hx-vivid")).map((e) => e.className).slice(0, 5));
  assert.deepEqual(over, [], "nothing in the hero is wider than the viewport");
  const f = await page.evaluate(() => {
    const r = (s) => { const x = document.querySelector(s).getBoundingClientRect(); return { top: x.top, bottom: x.bottom, height: x.height }; };
    return { h1: r("#hero-title-h1"), row3: r('[data-testid="hero-row-3"]'), vh: innerHeight, z: document.querySelector(".hx-colbox").offsetWidth / 204 };
  });
  assert.ok(f.h1.top >= 64 && f.h1.bottom < f.row3.top, `headline above the column, clear of the header: ${JSON.stringify(f)}`);
  assert.ok(f.row3.bottom <= f.vh, `first screen shows lights, Favorites and rows: row 3 bottom ${f.row3.bottom} vs ${f.vh}`);
  assert.ok(f.row3.height >= 36, `rows are large on a phone: ${f.row3.height}`);
  assert.ok(f.z > 1.6 && f.z <= 1.9, `phone z ${f.z}`);
  assert.equal(await page.$eval("#how", (e) => getComputedStyle(e).position), "static");
  await page.evaluate(() => document.querySelector('[data-testid="hero-row-0"]').click());
  assert.equal(await page.$eval('[data-testid="hero-pop"]', (e) => getComputedStyle(e).position), "fixed");
  await page.close();
});
