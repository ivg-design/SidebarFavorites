// Under the hood: the bundle tree and its panel.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3248";
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

const pane = (k) => `[data-testid="uh-pane-${k}"]`;
const on = (page, k) => page.$eval(pane(k), (e) => e.dataset.on === "true");

test("hood: exec is selected by default, its pane shows the real 17-byte script", async () => {
  const page = await open();
  assert.equal(await attr(page, '[data-testid="uh-node-exec"]', "aria-pressed"), "true");
  assert.ok(await on(page, "exec"));
  const t = await text(page, pane("exec"));
  assert.match(t, /17 bytes/); assert.match(t, /#!\/bin\/sh/); assert.match(t, /exit 0/); assert.match(t, /no-op/);
  await page.close();
});

test("hood: click plist resolves the panel and moves the selected mark", async () => {
  const page = await open();
  await page.$eval('[data-testid="uh-node-plist"]', (e) => e.scrollIntoView({ block: "center" }));
  await page.click('[data-testid="uh-node-plist"]');
  assert.ok(await until(() => on(page, "plist")));
  assert.match(await text(page, pane("plist")), /UTExportedTypeDeclarations/);
  assert.equal(await attr(page, '[data-testid="uh-node-plist"]', "aria-pressed"), "true");
  assert.equal(await attr(page, '[data-testid="uh-node-exec"]', "aria-pressed"), "false");
  assert.equal(await on(page, "exec"), false);
  await page.close();
});

test("hood: advanced mentions Finder Sync; config mentions osType", async () => {
  const page = await open();
  await page.$eval('[data-testid="uh-node-advanced"]', (e) => e.scrollIntoView({ block: "center" }));
  await page.click('[data-testid="uh-node-advanced"]');
  assert.ok(await until(() => on(page, "advanced")));
  assert.match(await text(page, pane("advanced")), /Finder.Sync/);
  await page.click('[data-testid="uh-node-config"]');
  assert.match(await text(page, pane("config")), /osType/);
  await page.close();
});

test("hood: nodes are 44px buttons and the keyboard works (arrows move focus, Enter selects)", async () => {
  const page = await open();
  const hs = await page.$$eval('[data-testid^="uh-node-"]', (b) => b.map((x) => x.getBoundingClientRect().height));
  assert.equal(hs.length, 8);
  assert.ok(hs.every((h) => h >= 44), hs.join());
  await page.focus('[data-testid="uh-node-config"]');
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), "uh-node-icons");
  await page.keyboard.press("Enter");
  assert.ok(await until(() => on(page, "icons")));
  await page.close();
});

test("hood: 390 has no horizontal overflow and the tree fits", async () => {
  const page = await open({ width: 390, height: 800 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const over = await page.$$eval('#hood .uh-node, #hood .uh-panel', (els) => els.filter((e) => e.getBoundingClientRect().right > 390).length);
  assert.equal(over, 0);
  await page.close();
});
