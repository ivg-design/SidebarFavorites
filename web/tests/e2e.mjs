// End-to-end tests for every interactive demo. Needs a running server:
//   BASE=http://localhost:3203 node --test tests/e2e.mjs
// Uses the system Chrome headless through puppeteer-core. Never opens a window.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3203";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open(path, { width = 1440, height = 900, reduced = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  return page;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test("landing: no horizontal scroll at 1440 / 834 / 390", async () => {
  for (const width of [1440, 834, 390]) {
    const page = await open("/", { width });
    assert.ok(await noOverflow(page), `overflow at ${width}`);
    await page.close();
  }
});

test("before/after: choosing an icon updates the row, reset restores", async () => {
  const page = await open("/", { reduced: true });
  const row = '[data-testid="after-row-0"]';
  await page.waitForSelector(row);
  await page.$eval(row, (e) => e.scrollIntoView({ block: "center" }));
  const before = await page.$eval(row, (e) => e.innerHTML);
  await page.click(row);
  await page.waitForSelector('[data-testid="glyph-popover"]');
  const option = '[data-testid="glyph-option-star.fill"]';
  await page.click(option);
  await page.waitForFunction(() => !document.querySelector('[data-testid="glyph-popover"]'));
  const after = await page.$eval(row, (e) => e.innerHTML);
  assert.notEqual(before, after, "row did not change");
  await page.click('[data-testid="after-reset"]');
  await page.waitForFunction((sel, html) => document.querySelector(sel)?.innerHTML === html, {}, row, before);
  await page.close();
});

test("before/after: Escape closes the picker and returns focus", async () => {
  const page = await open("/", { reduced: true });
  const row = '[data-testid="after-row-1"]';
  await page.$eval(row, (e) => e.scrollIntoView({ block: "center" }));
  await page.click(row);
  await page.waitForSelector('[data-testid="glyph-popover"]');
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-testid="glyph-popover"]'));
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-testid")), "after-row-1");
  await page.close();
});

test("before/after popover fits a 390 px viewport", async () => {
  const page = await open("/", { width: 390, height: 800, reduced: true });
  const row = '[data-testid="after-row-6"]';
  await page.$eval(row, (e) => e.scrollIntoView({ block: "center" }));
  await page.click(row);
  await page.waitForSelector('[data-testid="glyph-popover"]');
  const box = await (await page.$('[data-testid="glyph-popover"]')).boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390 + 1, `popover out of viewport: ${JSON.stringify(box)}`);
  assert.ok(await noOverflow(page));
  await page.close();
});

test("size slider scales the live glyph between 0.5 and 1.5, reset returns to 1", async () => {
  const page = await open("/", { reduced: true });
  const range = '[data-testid="size-toy-range"]';
  await page.$eval(range, (e) => e.scrollIntoView({ block: "center" }));
  const k = () => page.$eval('[data-testid="size-toy-live"]', (e) => getComputedStyle(e).getPropertyValue("--k").trim());
  assert.equal(await k(), "1");
  const set = (v) => page.$eval(range, (e, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(e, v); e.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);
  await set(50); assert.equal(await k(), "0.5");
  await set(150); assert.equal(await k(), "1.5");
  await page.click('[data-testid="size-toy-reset"]');
  assert.equal(await k(), "1");
  await page.close();
});

test("copy chip copies the brew command and flips to a check", async () => {
  const page = await open("/", { reduced: true });
  await browser.defaultBrowserContext().overridePermissions(BASE, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);
  await page.click("[data-testid=copy-chip]");
  await page.waitForSelector("[data-testid=copy-chip] .swap[data-on='true']");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(text, "brew install --cask sidebarfavorites");
  await page.waitForFunction(() => !document.querySelector("[data-testid=copy-chip] .swap[data-on='true']"), { timeout: 4000 });
  await page.close();
});

test("install brew box copies all three commands", async () => {
  const page = await open("/", { reduced: true });
  await browser.defaultBrowserContext().overridePermissions(BASE, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);
  await page.click("#install .cp");
  await new Promise((r) => setTimeout(r, 300));
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(text, "brew tap ivg-design/tap\nbrew trust ivg-design/tap\nbrew install --cask sidebarfavorites");
  await page.close();
});

test("docs: Cmd/Ctrl+K opens search, finds a page, Enter navigates, Esc closes", async () => {
  const page = await open("/docs", { reduced: true });
  await page.keyboard.down("Control"); await page.keyboard.press("k"); await page.keyboard.up("Control");
  await page.waitForSelector('[data-testid="docs-search-input"]');
  await page.type('[data-testid="docs-search-input"]', "uninstall");
  await page.waitForFunction(() => /uninstall/i.test(document.querySelector('[data-testid="docs-search-result"]')?.textContent ?? ""));
  const first = await page.$eval('[data-testid="docs-search-result"]', (e) => e.textContent);
  assert.match(first, /uninstall/i);
  assert.ok(!/&amp;|&#\d+;|&nbsp;/.test(first), "entities leaked into search results");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.pathname.endsWith("/docs/uninstalling"));
  await page.keyboard.down("Control"); await page.keyboard.press("k"); await page.keyboard.up("Control");
  await page.waitForSelector('[data-testid="docs-search-input"]');
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-testid="docs-search-input"]'));
  await page.close();
});

test("docs: brand links to site home, header icon is header height minus 10px, no entities", async () => {
  const page = await open("/docs/troubleshooting", { reduced: true });
  const info = await page.evaluate(() => {
    const brand = document.querySelector("header a[href]");
    const img = brand.querySelector("img");
    const header = brand.closest("header");
    return { href: brand.getAttribute("href"), icon: img.getBoundingClientRect().height, header: header.getBoundingClientRect().height };
  });
  assert.ok(!/\/docs\/?$/.test(info.href), `brand href ${info.href}`);
  assert.ok(Math.abs(info.icon - (info.header - 10)) <= 1, `icon ${info.icon} header ${info.header}`);
  const html = await page.evaluate(() => document.querySelector("main")?.innerText + document.querySelector('[data-testid="docs-toc"]')?.innerText);
  assert.ok(!/&amp;|&#\d+;|&nbsp;|&lt;|&gt;/.test(html), "entities visible");
  await page.close();
});

test("docs: shell is centred on a 1920 px screen and nothing overflows at 390", async () => {
  const page = await open("/docs", { width: 1920, height: 1000, reduced: true });
  const m = await page.evaluate(() => {
    const art = document.querySelector("main, article");
    const r = art.getBoundingClientRect();
    return { left: r.left, right: window.innerWidth - r.right };
  });
  assert.ok(m.left > 200, `article not centred: ${JSON.stringify(m)}`);
  await page.close();
  const slugs = ["", "/install", "/updates", "/custom-svg-icons", "/cloud-folders", "/disks-and-shares", "/keeping-both-icons", "/menu-bar-popover", "/how-it-works", "/config-json", "/uninstalling", "/building-from-source", "/nix-flake", "/troubleshooting", "/faq", "/report-an-issue"];
  for (const s of slugs) {
    const p = await open("/docs" + s, { width: 390, height: 800, reduced: true });
    assert.ok(await noOverflow(p), `docs${s} overflows at 390`);
    await p.close();
  }
  const c = await open("/changelog", { width: 390, height: 800, reduced: true });
  assert.ok(await noOverflow(c), "changelog overflows at 390");
  await c.close();
});

test("docs: copy button on a code block copies and confirms", async () => {
  await browser.defaultBrowserContext().overridePermissions(BASE, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);
  const page = await open("/docs/install", { reduced: true });
  await page.click('[data-testid="docs-copy"]');
  await new Promise((r) => setTimeout(r, 300));
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /brew/);
  await page.close();
});
