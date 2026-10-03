// Everywhere: kinds, the Locations-only switch, Finder's own rows.
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

const row = (k) => `[data-testid="ev-row-${k}"]`;
const SW = '[data-testid="ev-locations-only"]';
const vis = (page, sel) => page.$eval(sel, (e) => { const w = e.closest(".ev-collapse") || e; return w.getBoundingClientRect().height > 1 && w.getAttribute("aria-hidden") !== "true"; });

test("everywhere: Mounted disks reveals the switch; on hides the Favorites disk row, Locations row keeps its glyph", async () => {
  const page = await open();
  await page.$eval('[data-testid="ev-kind-disk"]', (e) => e.scrollIntoView({ block: "center" }));
  await page.click('[data-testid="ev-kind-disk"]');
  assert.ok(await until(() => page.$eval(SW, (e) => e.getBoundingClientRect().height > 0)), "switch not revealed");
  assert.equal(await vis(page, row("fav-work2tbssd")), true);
  await page.click(SW);
  assert.equal(await attr(page, SW, "aria-checked"), "true");
  assert.ok(await until(async () => !(await vis(page, row("fav-work2tbssd")))), "favorites row still visible");
  const g = await attr(page, row("work2tbssd"), "data-glyph");
  assert.notEqual(g, "drive");
  assert.equal(g, "briefcase.fill");
  await page.close();
});

test("everywhere: the switch is hidden for kinds without volumes", async () => {
  const page = await open();
  await page.click('[data-testid="ev-kind-cloud"]');
  assert.ok(await until(() => page.$eval(SW, (e) => e.closest(".ev-collapse").getAttribute("aria-hidden") === "true")));
  await page.close();
});

test("everywhere: iCloud & CloudStorage tags Finder's own row", async () => {
  const page = await open();
  await page.click('[data-testid="ev-kind-cloud"]');
  const t = await page.$eval(row("icloud-drive"), (e) => e.textContent.replace(/[’']/g, "'"));
  assert.match(t, /Finder's own row/);
  assert.equal(await attr(page, row("icloud-drive"), "data-sel"), "true");
  await page.close();
});

test("everywhere: the note changes between kinds", async () => {
  const page = await open();
  const seen = new Set();
  for (const k of ["local", "cloud", "disk", "share"]) {
    await page.click(`[data-testid="ev-kind-${k}"]`);
    seen.add(await text(page, '[data-testid="ev-note"]'));
  }
  assert.equal(seen.size, 4);
  await page.close();
});
