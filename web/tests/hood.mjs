// Under the hood: the bundle tree and its panel.
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

const P = '[data-testid="uh-panel"]';

test("hood: exec is selected by default and the panel mentions 17", async () => {
  const page = await open();
  assert.equal(await attr(page, '[data-testid="uh-node-exec"]', "aria-pressed"), "true");
  assert.match(await text(page, P), /17/);
  await page.close();
});

test("hood: plist swaps the panel to OverrideIcon.OSType", async () => {
  const page = await open();
  await page.$eval('[data-testid="uh-node-plist"]', (e) => e.scrollIntoView({ block: "center" }));
  await page.click('[data-testid="uh-node-plist"]');
  assert.ok(await until(async () => /OverrideIcon\.OSType/.test(await text(page, P))));
  assert.equal(await attr(page, '[data-testid="uh-node-plist"]', "aria-pressed"), "true");
  assert.equal(await attr(page, '[data-testid="uh-node-exec"]', "aria-pressed"), "false");
  await page.close();
});

test("hood: advanced mentions Finder Sync", async () => {
  const page = await open();
  await page.$eval('[data-testid="uh-node-advanced"]', (e) => e.scrollIntoView({ block: "center" }));
  await page.click('[data-testid="uh-node-advanced"]');
  assert.ok(await until(async () => /Finder Sync/.test(await text(page, P))));
  await page.close();
});
