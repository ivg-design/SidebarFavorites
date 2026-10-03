// Owner rule: proper nouns, product names, versions and key combos never break across lines.
//   BASE=http://localhost:3203 node --test tests/nowrap.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3203";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGES = ["/", "/docs", "/docs/install", "/docs/keeping-both-icons", "/docs/config-json", "/changelog", "/nope-404"];
const PHRASES = ["IVG Design", "SidebarFavorites", "SF Symbols", "SF Symbol", "Apple Silicon", "iCloud Drive", "Google Drive", "macOS 13+", "macOS 26", "Launch Services", "System Settings", "Finder Sync", "Developer ID", "Both icons", "Restart Finder"];
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

/** Every occurrence of each phrase (plain or with no-break spaces) must sit on one line: all its client rects share a top. */
const BROKEN = (phrases) => {
  const nbsp = (s) => s.replaceAll(" ", " ");
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const versionRe = /\b\d+\.\d+\.\d+\b/g;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement; if (!el || !el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
    const txt = n.nodeValue;
    const hits = [];
    for (const p of phrases) for (const form of [p, nbsp(p)]) { let i = -1; while ((i = txt.indexOf(form, i + 1)) >= 0) hits.push([i, form.length, p]); }
    for (const m of txt.matchAll(versionRe)) hits.push([m.index, m[0].length, m[0]]);
    for (const [i, len, label] of hits) {
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + len);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0);
      const tops = new Set(rects.map((x) => Math.round(x.top)));
      if (tops.size > 1) out.push(`${label} in <${el.tagName.toLowerCase()} class="${el.className}">`);
    }
  }
  return out;
};

for (const width of [1440, 834, 390]) {
  test(`no protected phrase breaks across lines at ${width}`, async () => {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    const broken = [];
    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: "networkidle0" });
      const b = await page.evaluate(BROKEN, PHRASES);
      broken.push(...b.map((x) => `${path}: ${x}`));
    }
    await page.close();
    assert.deepEqual(broken, []);
  });
}
