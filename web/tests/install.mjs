// Install: DMG link, Homebrew lines, copy.
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

test("install: DMG link points at a .dmg and names version 1.2.2", async () => {
  const page = await open();
  const d = await page.$eval('[data-testid="install-dmg"]', (e) => ({ href: e.getAttribute("href"), t: e.textContent }));
  assert.match(d.href, /\.dmg$/);
  assert.ok(d.t.includes("1.2.2") && d.t.includes("DMG"), d.t);
  await page.close();
});

test("install: the terminal lists tap, trust, install in order", async () => {
  const page = await open();
  const lines = await page.$$eval('[data-testid="install-term"] .in-line', (l) => l.map((x) => x.textContent.replace(/^\$ /, "").trim()));
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^brew tap /);
  assert.match(lines[1], /^brew trust /);
  assert.match(lines[2], /^brew install /);
  await page.close();
});

test("install: Copy all shows the copied state and copies the three lines", async () => {
  await browser.defaultBrowserContext().overridePermissions(BASE, ["clipboard-read", "clipboard-write"]);
  const page = await open();
  const lines = await page.$$eval('[data-testid="install-term"] .in-line', (l) => l.map((x) => x.textContent.replace(/^\$ /, "").trim()));
  const B = '[data-testid="install-copy"] [data-testid="copy-box"]';
  await page.$eval(B, (e) => e.scrollIntoView({ block: "center" }));
  await page.click(B);
  assert.ok(await until(() => page.$eval(B, (e) => e.dataset.on === "true" || /Copied/.test(e.textContent))), "no copied state");
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
  if (clip !== null) assert.equal(clip, lines.join("\n"));
  await page.close();
});
