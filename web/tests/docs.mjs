// Docs + changelog tests. Needs a running server: BASE=http://localhost:3249 node --test tests/docs.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3249";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Registry order = nav order = prev/next order.
const SLUGS = ["quick-start", "install", "updates", "custom-svg-icons", "cloud-folders", "disks-and-shares", "keeping-both-icons", "menu-bar-popover", "how-it-works", "config-json", "uninstalling", "building-from-source", "nix-flake", "troubleshooting", "faq", "report-an-issue"];
const path = (slug) => (slug === "quick-start" ? "/docs" : `/docs/${slug}`);
const ENTITY = /&(?:[a-z][a-z0-9]*|#\d+|#x[0-9a-f]+);/i;
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open(p, { width = 1440, height = 900 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + p, { waitUntil: "networkidle0" });
  return page;
}

test("docs: prev/next are correct on the first, a middle and the last page", async () => {
  for (const i of [0, 6, SLUGS.length - 1]) {
    const page = await open(path(SLUGS[i]));
    const got = await page.evaluate(() => {
      const read = (id) => { const a = document.querySelector(`[data-testid="${id}"]`); return a && { href: new URL(a.href).pathname, group: a.querySelector("small")?.textContent, text: a.textContent }; };
      return { prev: read("docs-prev"), next: read("docs-next") };
    });
    const want = (j) => SLUGS[j] && path(SLUGS[j]);
    for (const [dir, j] of [["prev", i - 1], ["next", i + 1]]) {
      if (!want(j)) { assert.equal(got[dir], null, `${SLUGS[i]} must not have ${dir}`); continue; }
      assert.ok(got[dir], `${SLUGS[i]} missing ${dir}`);
      assert.ok(got[dir].href.endsWith(want(j)), `${SLUGS[i]} ${dir} -> ${got[dir].href}`);
      assert.ok(got[dir].group, `${SLUGS[i]} ${dir} has no group label`);
    }
    await page.close();
  }
});

test("docs: every screenshot is shown whole (rendered ratio equals natural ratio)", async () => {
  for (const slug of SLUGS) {
    const page = await open(path(slug));
    await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll(".dx-fig img")];
      imgs.forEach((i) => { i.loading = "eager"; });
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
    });
    const figs = await page.evaluate(() => [...document.querySelectorAll(".dx-fig img")].map((i) => {
      const r = i.getBoundingClientRect();
      return { src: i.currentSrc, nat: i.naturalWidth / i.naturalHeight, shown: r.width / r.height, caption: i.closest("figure").querySelector("figcaption")?.textContent ?? "", alt: i.alt };
    }));
    for (const f of figs) {
      assert.ok(Math.abs(f.shown / f.nat - 1) <= 0.01, `${slug}: ${f.src} cropped (natural ${f.nat.toFixed(3)}, shown ${f.shown.toFixed(3)})`);
      assert.ok(f.caption.length > 10 && f.alt.length > 10, `${slug}: ${f.src} needs a caption and alt`);
    }
    await page.close();
  }
});

test("docs: quick start has the three screenshots the README places there", async () => {
  const page = await open("/docs");
  const srcs = await page.evaluate(() => [...document.querySelectorAll(".dx-fig img")].map((i) => i.src));
  for (const n of ["SBFMainWindow", "SBFAddFavoriteWindow", "SFSymbolBrowser"]) assert.ok(srcs.some((s) => s.includes(n)), `missing ${n}`);
  await page.close();
});

test("docs: no HTML entities in any page text, title, nav, toc, search or the changelog", async () => {
  for (const p of [...SLUGS.map(path), "/changelog"]) {
    const res = await fetch(BASE + p);
    const html = await res.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ")
      .replace(/&(?:lt|gt|quot|#x27|#39);/g, " ").replace(/&amp;/g, "&");
    const m = text.match(ENTITY);
    assert.ok(!m, `${p}: literal entity ${m?.[0]}`);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    assert.ok(!/&(?:rsquo|amp|mdash|ndash|ldquo|rdquo);/.test(title), `${p}: entity in title`);
  }
  const page = await open("/docs");
  await page.keyboard.down("Control"); await page.keyboard.press("k"); await page.keyboard.up("Control");
  await page.waitForSelector('[data-testid="docs-search-input"]');
  await page.type('[data-testid="docs-search-input"]', "Finder");
  const txt = await page.$eval(".dx-pal-list", (e) => e.textContent);
  assert.ok(!ENTITY.test(txt), "entity in search results");
  await page.close();
});

test("docs: rail rows are 30px with a 16px glyph, current page is marked; mobile picker rows are 44px", async () => {
  const page = await open("/docs/updates");
  const info = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".dx-rail .dx-row")];
    const cur = document.querySelector('.dx-rail .dx-row[aria-current="page"]');
    return { n: rows.length, h: rows[0].getBoundingClientRect().height, svg: rows.every((r) => r.querySelector("svg")?.getBoundingClientRect().width === 16), cur: cur?.textContent };
  });
  assert.equal(info.n, SLUGS.length);
  assert.equal(info.h, 30);
  assert.ok(info.svg, "every row has a 16px glyph");
  assert.equal(info.cur, "Updates");
  await page.close();
  const m = await open("/docs/updates", { width: 390, height: 800 });
  await m.click(".dx-mnav-btn");
  const h = await m.$eval(".dx-mnav-panel .dx-row", (e) => e.getBoundingClientRect().height);
  assert.ok(h >= 44, `picker row ${h}`);
  const bar = await m.$eval(".dx-mnav-btn", (e) => e.getBoundingClientRect().height);
  assert.ok(bar >= 44);
  await m.close();
});

test("docs: search button is focusable and Enter opens the palette; toc hides at 834", async () => {
  const page = await open("/docs");
  await page.focus('[data-testid="docs-search-open"]');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  assert.equal(focused, "docs-search-open");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="docs-search-input"]');
  await page.close();
  const w = await open("/docs", { width: 834, height: 900 });
  assert.equal(await w.$eval(".dx-toc", (e) => getComputedStyle(e).display), "none");
  await w.close();
});

test("changelog: per-version anchors, same shell", async () => {
  const page = await open("/changelog");
  const info = await page.evaluate(() => ({ ids: [...document.querySelectorAll(".cl-entry")].map((e) => e.id), rail: !!document.querySelector(".dx-rail"), toc: document.querySelectorAll('[data-testid="docs-toc"] a').length }));
  assert.ok(info.ids.length > 3 && info.ids.every((i) => /^v/.test(i)));
  assert.ok(info.rail);
  assert.equal(info.toc, info.ids.length);
  await page.close();
});

test("docs: opening the search palette moves nothing by a pixel (scrollbar gutter)", async () => {
  const page = await open("/docs/config-json");
  const measure = () => page.evaluate(() => ["header a[href]", ".dx-rail", "main"].map((q) => document.querySelector(q).getBoundingClientRect().left));
  const before = await measure();
  await page.keyboard.down("Control"); await page.keyboard.press("k"); await page.keyboard.up("Control");
  await page.waitForSelector('[data-testid="docs-search-input"]');
  assert.deepEqual(await measure(), before);
  await page.close();
});

test("docs: table code tokens never wrap mid-word", async () => {
  for (const width of [1440, 390]) {
    const page = await open("/docs/config-json", { width });
    const bad = await page.evaluate(() => [...document.querySelectorAll(".dx-table code")].filter((c) => c.getClientRects().length > 1).map((c) => c.textContent));
    assert.deepEqual(bad, [], `wrapped at ${width}`);
    await page.close();
  }
});

test("docs: article is centred, tables set code nowrap, headings use the display font", async () => {
  const t = await open("/docs/config-json");
  const code = await t.$$eval(".dx-table td code", (c) => c.map((x) => getComputedStyle(x).whiteSpace));
  assert.ok(code.length > 0 && code.every((x) => x === "nowrap"), "table code: " + code);
  await t.close();
  const page = await open("/docs/custom-svg-icons");
  const r = await page.evaluate(() => {
    const a = document.querySelector(".dx-main"), h = a.getBoundingClientRect(), cs = getComputedStyle(a);
    const pr = parseFloat(cs.paddingRight), pl = parseFloat(cs.paddingLeft);
    const body = document.querySelector(".dx-body").getBoundingClientRect();
    const mid = (h.left + pl + h.right - pr) / 2, bm = (body.left + body.right) / 2;
    const code = [...document.querySelectorAll(".dx-table td code")].map((c) => getComputedStyle(c).whiteSpace);
    const fam = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).fontFamily : null; };
    const w = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).fontWeight : null; };
    return { off: Math.abs(mid - bm), code, h1: fam(".dx-h1"), h2: fam(".dx-h2"), body: fam("body"), w1: w(".dx-h1"), w2: w(".dx-h2"), w3: w(".dx-h3"), ws: w(".dx-step-title") };
  });
  assert.ok(r.off < 2, "article centre off by " + r.off);
  assert.match(r.h1, /schibsted/i); assert.match(r.h2, /schibsted/i);
  assert.equal(r.w1, "700"); assert.equal(r.w2, "700");
  if (r.w3) assert.equal(r.w3, "600");
  await page.close();
});
