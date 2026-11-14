// Install: DMG link, official Homebrew command, copy.
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

test("install: DMG link points at a .dmg and names version and size", async () => {
  const page = await open();
  const d = await page.$eval('[data-testid="install-dmg"]', (e) => ({ href: e.getAttribute("href"), t: e.textContent }));
  assert.match(d.href, /\.dmg$/);
  assert.ok(/\d+\.\d+\.\d+/.test(d.t) && d.t.includes("DMG") && /\d+ MB/.test(d.t), d.t);
  await page.close();
});

test("install: the terminal shows the official Homebrew cask command", async () => {
  const page = await open();
  const lines = await page.$$eval('[data-testid="install-term"] .in-line', (l) => l.map((x) => x.textContent.replace(/^\$ /, "").trim()));
  assert.deepEqual(lines, ["brew install --cask sidebarfavorites-manager"]);
  assert.ok(await page.$eval('[data-testid="install-term"]', (e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true })), "install command must remain visible with reduced motion");
  await page.close();
});

test("install: Copy shows the copied state and copies the official command", async () => {
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

test("install: the full brew command fits at 390 without horizontal scrolling", async () => {
  const page = await open({ width: 390, height: 800 });
  const m = await page.$eval('[data-testid="install-term"] .in-lines', (e) => ({ sw: e.scrollWidth, cw: e.clientWidth, ws: getComputedStyle(e).whiteSpace }));
  assert.equal(m.ws, "pre-wrap");
  assert.ok(m.sw <= m.cw, `brew block scrolls: ${m.sw} > ${m.cw}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.close();
});

test("install: footer home link wraps the 56px icon", async () => {
  const page = await open();
  const f = await page.$eval('[data-testid="footer-home"]', (e) => ({ h: e.getAttribute("href"), w: e.getBoundingClientRect().width, h2: e.getBoundingClientRect().height }));
  assert.equal(f.w, 56); assert.equal(f.h2, 56); assert.match(f.h, /^\//);
  await page.close();
});
