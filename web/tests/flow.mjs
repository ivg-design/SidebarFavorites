// Narrative sections: Everywhere tabs, Under the hood numerals, demo poster/video.
//   BASE=http://localhost:3234 node --test tests/flow.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3234";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open(path, { width = 1440, reduced = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  return page;
}
const sel = (page) => page.$$eval('[data-testid^="everywhere-row-"]', (rows) => rows.filter((r) => r.dataset.sel === "true").map((r) => r.dataset.testid.replace("everywhere-row-", "")));

test("everywhere: tabs select their sidebar rows and flip the word", async () => {
  const page = await open("/", { reduced: true });
  const expected = [
    ["Local folders.", ["desktop", "projects", "invoices"]],
    ["iCloud & CloudStorage.", ["google-drive", "dropbox", "onedrive"]],
    ["Mounted disks.", ["work2tbssd"]],
    ["Network shares.", ["studio-nas"]],
  ];
  for (const [i, [word, rows]] of expected.entries()) {
    await page.$eval(`[data-testid="everywhere-tab-${i}"]`, (e) => e.scrollIntoView({ block: "center" }));
    await page.click(`[data-testid="everywhere-tab-${i}"]`);
    await page.waitForFunction((w) => document.querySelector('[data-testid="everywhere-word"]').textContent === w, {}, word);
    assert.deepEqual(await sel(page), rows);
    assert.equal(await page.$eval(`[data-testid="everywhere-tab-${i}"]`, (e) => e.getAttribute("aria-selected")), "true");
  }
  await page.close();
});

test("everywhere: arrow keys move tabs and stop auto-advance", async () => {
  const page = await open("/", { reduced: false });
  await page.$eval('[data-testid="everywhere-tab-0"]', (e) => e.scrollIntoView({ block: "center" }));
  await page.focus('[data-testid="everywhere-tab-0"]');
  await page.keyboard.press("ArrowDown");
  await new Promise((r) => setTimeout(r, 3600));
  assert.equal(await page.$eval('[data-testid="everywhere-tab-1"]', (e) => e.getAttribute("aria-selected")), "true");
  await page.close();
});

test("hood numerals flip in and end on the exact strings", async () => {
  const page = await open("/", { reduced: false });
  await page.$eval("#hood", (e) => e.scrollIntoView());
  await page.$eval('[data-testid="hood-num-3"]', (e) => e.scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 2200));
  const shown = await page.$$eval('[data-testid^="hood-num-"]', (els) => els.map((e) => e.textContent));
  assert.deepEqual(shown, ["17 bytes", "0 processes", "1 file", "1 request"]);
  await page.close();
});

test("demo poster is served and the video has no <source> while no recording exists", async () => {
  const page = await open("/", { reduced: true });
  const poster = await page.$eval('[data-testid="demo-video"] video', (v) => v.getAttribute("poster"));
  assert.ok(poster.includes("demo-poster"));
  const res = await fetch(new URL(poster, BASE));
  assert.equal(res.status, 200);
  assert.equal(await page.$eval('[data-testid="demo-video"] video', (v) => v.querySelectorAll("source").length), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.close();
});
