// Docs + changelog tests. Needs a running server: BASE=http://localhost:3249 node --test tests/docs.mjs
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3249";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Registry order = nav order = prev/next order.
const SLUGS = ["quick-start", "install", "updates", "custom-svg-icons", "spacers", "cloud-folders", "disks-and-shares", "keeping-both-icons", "menu-bar-popover", "how-it-works", "settings", "config-json", "uninstalling", "building-from-source", "nix-flake", "troubleshooting", "faq", "report-an-issue"];
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

test("docs: quick start shows the manager window, the editor and the symbol browser", async () => {
  const page = await open("/docs");
  const srcs = await page.evaluate(() => [...document.querySelectorAll(".dx-fig img")].map((i) => i.src));
  for (const n of ["main-window", "editor-add", "symbol-browser"]) assert.ok(srcs.some((s) => s.includes(n)), `missing ${n}`);
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

test("docs: the search palette covers the viewport and its input can be typed into (not trapped in the sticky bar)", async () => {
  // `.dx-top` has a backdrop-filter, which makes it the containing block for fixed descendants; a palette rendered
  // inside it was clipped to the bar - a grey band with no input. It is portalled to <body>.
  const page = await open("/docs/settings");
  await page.click('[data-testid="docs-search-open"]');
  await page.waitForSelector('[data-testid="docs-search-input"]');
  await new Promise((r) => setTimeout(r, 300));
  const r = await page.evaluate(() => {
    const pal = document.querySelector(".dx-pal").getBoundingClientRect();
    const input = document.querySelector('[data-testid="docs-search-input"]');
    const box = input.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { palH: pal.height, vh: innerHeight, inH: box.height, inTop: box.top, onTop: hit === input, inHeader: !!input.closest(".dx-top") };
  });
  assert.ok(r.palH >= r.vh - 1, `overlay covers ${r.palH}px of a ${r.vh}px viewport`);
  assert.ok(!r.inHeader, "palette is not rendered inside the sticky bar");
  assert.ok(r.inH > 20 && r.inTop >= 0 && r.inTop < r.vh, "input is on screen");
  assert.ok(r.onTop, "input is the topmost element at its centre");
  await page.type('[data-testid="docs-search-input"]', "spacer");
  assert.equal(await page.$eval('[data-testid="docs-search-input"]', (e) => e.value), "spacer");
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

test("docs: table code tokens break only at separators, short ones stay whole", async () => {
  for (const width of [1440, 390]) {
    const page = await open("/docs/config-json", { width });
    const bad = await page.evaluate(() => [...document.querySelectorAll(".dx-table code")].filter((c) => {
      if (c.getClientRects().length < 2) return false;
      // wrapped: allowed only if long (>14 chars; spaces are break points too) and every line break falls after a separator
      const t = c.textContent; if (t.length <= 14 && !/\s/.test(t)) return true;
      const r = document.createRange(); let prevTop = null;
      const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
      let prevChar = "";
      for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) for (let i = 0; i < tn.length; i++) {
        r.setStart(tn, i); r.setEnd(tn, i + 1);
        const top = Math.round(r.getBoundingClientRect().top);
        if (prevTop !== null && top > prevTop + 2 && !/[\s/._\-:=?&,]/.test(prevChar)) return true;
        prevTop = top; prevChar = tn.data[i];
      }
      return false;
    }).map((c) => c.textContent));
    assert.deepEqual(bad, [], `bad wrap at ${width}`);
    await page.close();
  }
});

test("docs: article is centred, tables never scroll, headings use the display font", async () => {
  const t = await open("/docs/config-json");
  const scr = await t.$$eval(".dx-table", (c) => c.map((x) => getComputedStyle(x).overflowX));
  assert.ok(scr.length > 0 && scr.every((x) => x === "visible"), "table overflow: " + scr);
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

// The docs describe the app as it is now: no version history outside the changelog (owner rule).
// Code and quoted app strings are data, so they are skipped; macOS 13 and macOS 26 name systems, not releases of the app.
const HISTORY = /\b(new in\b|what['\u2019]s new|since (?:version |v)?\d|as of (?:version |v)?\d|previously|formerly|no longer|(?<!is |are |be |been |being |was |were )used to\b|as before|in earlier versions|older versions?|the old (?:mechanism|readme|version|workaround|way|design)|before (?:version |v)?\d+\.\d|v?\d+\.\d+\.\d+|version \d+\.\d|replaces the (?:old|previous)|migrat(?:e|ed|ion))/i;
test("docs: no version-history framing, at most one changelog link, structure rules", async () => {
  const problems = [];
  const check = (cond, msg) => { if (!cond) problems.push(msg); };
  for (const slug of SLUGS) {
    const page = await open(path(slug));
    const r = await page.evaluate(() => {
      const root = document.querySelector(".dx-main").cloneNode(true);
      root.querySelectorAll("pre, code, q, .dx-pn, .dx-crumbs, .dx-toc-inline").forEach((e) => e.remove());
      const leaf = (e) => !e.querySelector("p, li, td");
      const blocks = [...root.querySelectorAll(".dx-lede, .dx-prose p, .dx-prose li, .dx-prose td, .dx-prose th, .dx-prose h2, .dx-prose h3, figcaption")].filter(leaf).map((e) => e.textContent.replace(/[\u201c"][^\u201d"]*[\u201d"]/g, " "));
      const live = document.querySelector(".dx-main");
      return {
        blocks,
        changelog: live.querySelectorAll('.dx-prose a[href$="/changelog"]').length,
        wide: [...live.querySelectorAll(".dx-table table")].filter((t) => t.rows[0].cells.length > 4).length,
        unlabelled: [...live.querySelectorAll(".dx-code")].filter((c) => !c.querySelector(".dx-code-k")?.textContent.trim()).length,
        callouts: [...live.querySelectorAll(".dx-callout")].map((c) => c.querySelector(".dx-callout-k")?.textContent.trim() ?? ""),
        dash: blocks.filter((t) => /\u2014/.test(t)).map((t) => t.slice(0, 60)),
        toc: [...live.querySelectorAll(".dx-prose h2[id]")].map((h) => h.id),
        tocList: [...document.querySelectorAll('[data-testid="docs-toc"] a')].map((a) => a.getAttribute("href").slice(1)),
        emptySteps: [...live.querySelectorAll(".dx-step")].filter((s) => !s.querySelector(".dx-step-title")?.textContent.trim()).length,
      };
    });
    const hits = r.blocks.map((t) => { const m = HISTORY.exec(t); return m ? `${m[0]} :: ${t.slice(0, 70)}` : ""; }).filter(Boolean);
    check(hits.length === 0, `${slug}: version-history framing ${JSON.stringify(hits)}`);
    check(r.changelog <= 1, `${slug}: ${r.changelog} changelog links`);
    check(r.wide === 0, `${slug}: a table has more than four columns`);
    check(r.unlabelled === 0, `${slug}: a code block has no label`);
    check(r.callouts.every((k) => ["Note", "Tip", "Warning"].includes(k)), `${slug}: callout kinds ${r.callouts}`);
    check(r.callouts.length <= 2, `${slug}: ${r.callouts.length} callouts`);
    check(r.dash.length === 0, `${slug}: em dash outside a quoted app string ${JSON.stringify(r.dash)}`);
    check(JSON.stringify(r.tocList) === JSON.stringify(r.toc), `${slug}: "On this page" ${r.tocList} must list every h2 in order ${r.toc}`);
    check(r.emptySteps === 0, `${slug}: a step has no action`);
    await page.close();
  }
  assert.deepEqual(problems, []);
});

test("docs: a figure enlarges into a dialog and returns focus", async () => {
  const page = await open("/docs/settings");
  await page.evaluate(() => document.querySelector(".dx-zoom").scrollIntoView({ block: "center" }));
  await page.focus(".dx-zoom");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-testid="docs-lightbox"][open] img');
  const lb = await page.evaluate(() => { const d = document.querySelector('[data-testid="docs-lightbox"]'); const i = d.querySelector("img"); return { alt: i.alt.length, cap: d.querySelector("figcaption span").textContent.length, focus: document.activeElement.className, w: i.getAttribute("width") }; });
  assert.ok(lb.alt > 10 && lb.cap > 10 && lb.w, JSON.stringify(lb));
  assert.equal(lb.focus, "dx-lightbox-x");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-testid="docs-lightbox"][open]'));
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains("dx-zoom")), "focus returns to the figure");
  const dims = await page.$$eval(".dx-fig img", (is) => is.every((i) => i.getAttribute("width") && i.getAttribute("height") && i.loading === "lazy"));
  assert.ok(dims, "figures carry width, height and lazy loading");
  await page.close();
});
