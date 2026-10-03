// Everywhere: row click -> the manager row (path, name, switch), selected state, keyboard, reduced motion.
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


const ROW = (k) => `[data-testid="ev-row-${k}"]`;
const PATH = '[data-testid="ev-path"]';
const SW = '[data-testid="ev-toggle"]';
const collapsed = (page, sel) => page.$eval(sel, (e) => e.closest(".ev-collapse").getBoundingClientRect().height < 2);

test("everywhere: starts on a local folder; the other rows are grey defaults", async () => {
  const page = await open({ path: "/#everywhere" });
  assert.equal(await attr(page, ROW("projects"), "data-sel"), "true");
  assert.equal(await text(page, PATH), "~/Projects");
  assert.equal(await attr(page, ROW("contracts"), "data-glyph"), "folder");
  assert.equal(await attr(page, ROW("disk"), "data-glyph"), "drive");
  await page.close();
});

test("everywhere: clicking each row resolves its glyph, selects it and shows its real path in the panel", async () => {
  const page = await open({ path: "/#everywhere" });
  const want = {
    contracts: ["icloud", "~/Library/Mobile Documents/com~apple~CloudDocs/Contracts"],
    motion: ["paperplane.fill", "~/Library/CloudStorage/GoogleDrive-you@example.com/My Drive/Motion Graphics"],
    brand: ["bookmark.fill", "~/Library/CloudStorage/Dropbox/Brand Assets"],
    disk: ["briefcase.fill", "/Volumes/WORK2TBSSD"],
    share: ["photo", "/Volumes/Studio NAS"],
  };
  for (const [k, [glyph, path]] of Object.entries(want)) {
    await page.click(ROW(k));
    assert.equal(await attr(page, ROW(k), "data-sel"), "true");
    assert.equal(await attr(page, ROW(k), "aria-current"), "true");
    assert.equal(await attr(page, ROW("projects"), "data-sel"), "false");
    assert.equal(await attr(page, ROW(k), "data-glyph"), glyph);
    assert.equal(await text(page, PATH), path);
  }
  await page.close();
});

test("everywhere: the path resolves (animation runs) and is skipped under reduced motion", async () => {
  const page = await open({ reduced: false, path: "/#everywhere" });
  await page.click(ROW("motion"));
  const a = await page.$eval(`${PATH}`, (e) => getComputedStyle(e.closest(".ev-resolve")).animationName);
  assert.equal(a, "ev-resolve");
  await page.close();
  const r = await open({ reduced: true, path: "/#everywhere" });
  await r.click(ROW("motion"));
  assert.ok(await until(() => r.$eval(PATH, (e) => +getComputedStyle(e.closest(".ev-resolve")).opacity > 0.99)));
  await r.close();
});

test("everywhere: keyboard focus + Enter selects a row; the switch removes and restores its sidebar row", async () => {
  const page = await open({ path: "/#everywhere" });
  await page.focus(ROW("share"));
  await page.keyboard.press("Enter");
  assert.equal(await attr(page, ROW("share"), "data-sel"), "true");
  assert.equal(await text(page, PATH), "/Volumes/Studio NAS");
  assert.equal(await attr(page, SW, "role"), "switch");
  assert.equal(await attr(page, SW, "aria-checked"), "true");
  await page.focus(SW);
  await page.keyboard.press("Space");
  assert.equal(await attr(page, SW, "aria-checked"), "false");
  assert.match(await text(page, '[data-testid="ev-state"]'), /Not in Sidebar/);
  assert.ok(await until(() => collapsed(page, ROW("share"))), "row still in sidebar");
  await page.keyboard.press("Space");
  assert.ok(await until(async () => !(await collapsed(page, ROW("share")))), "row did not return");
  assert.match(await text(page, '[data-testid="ev-state"]'), /^In Sidebar/);
  await page.close();
});

test("everywhere: the note follows the selected kind", async () => {
  const page = await open({ path: "/#everywhere" });
  const seen = new Set();
  for (const k of ["projects", "contracts", "disk", "share"]) { await page.click(ROW(k)); seen.add(await text(page, '[data-testid="ev-note"]')); }
  assert.equal(seen.size, 4);
  await page.close();
});

test("everywhere: no horizontal overflow at 390; switch is >= 44px", async () => {
  const page = await open({ width: 390, path: "/#everywhere" });
  const o = await page.$eval("#everywhere", (e) => Math.max(0, ...[...e.querySelectorAll("*")].map((n) => n.getBoundingClientRect().right)) - innerWidth);
  assert.ok(o <= 0, `overflow ${o}`);
  assert.ok((await page.$eval(SW, (e) => e.getBoundingClientRect().height)) >= 43);
  await page.close();
});
