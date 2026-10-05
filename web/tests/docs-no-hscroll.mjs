// Owner rule: NO horizontal scrolling anywhere in the docs. Crawls every docs URL + changelog at five widths.
//   BASE=http://localhost:3273 node --test tests/docs-no-hscroll.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3273";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SLUGS = ["install", "updates", "custom-svg-icons", "cloud-folders", "disks-and-shares", "keeping-both-icons", "menu-bar-popover", "how-it-works", "settings", "config-json", "uninstalling", "building-from-source", "nix-flake", "troubleshooting", "faq", "report-an-issue"];
const URLS = ["/docs", ...SLUGS.map((s) => `/docs/${s}`), "/changelog"];
const WIDTHS = [1440, 1280, 1024, 834, 390];
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: "new", args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

export const OFFENDERS = () => {
  const out = [];
  const d = document.documentElement;
  if (d.scrollWidth > d.clientWidth + 1) out.push(`document ${d.scrollWidth}>${d.clientWidth}`);
  if (document.body.scrollWidth > document.body.clientWidth + 1) out.push(`body ${document.body.scrollWidth}>${document.body.clientWidth}`);
  for (const el of document.querySelectorAll("body *")) {
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      const cs = getComputedStyle(el);
      if (cs.display === "inline") continue;
      out.push(`<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 40)}"> ${el.scrollWidth}>${el.clientWidth} overflow-x:${cs.overflowX}`);
    }
  }
  return out;
};

for (const width of WIDTHS) {
  test(`docs + changelog: no horizontal scroll at ${width}`, async () => {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    const bad = [];
    for (const u of URLS) {
      await page.goto(BASE + u, { waitUntil: "networkidle0" });
      bad.push(...(await page.evaluate(OFFENDERS)).map((x) => `${u}: ${x}`));
    }
    await page.close();
    assert.deepEqual(bad, []);
  });
}

test("docs: code blocks wrap and tables have no scroller or edge fade", async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 900 });
  await page.goto(BASE + "/docs/config-json", { waitUntil: "networkidle0" });
  const r = await page.evaluate(() => ({
    code: [...document.querySelectorAll(".dx-code code")].map((c) => getComputedStyle(c).whiteSpace),
    scrollers: [...document.querySelectorAll(".dx-table, .dx-code pre")].filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowX)).length,
  }));
  assert.ok(r.code.length && r.code.every((w) => w === "pre-wrap"), "code: " + r.code);
  assert.equal(r.scrollers, 0);
  await page.close();
});
